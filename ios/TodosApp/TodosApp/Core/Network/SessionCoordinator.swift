import Foundation

actor SessionCoordinator {
    private let tokenStorage: TokenStorage
    private let baseURL: URL
    private let session: URLSession
    private let onSessionInvalidated: @MainActor @Sendable () -> Void
    private var activeRefreshTask: Task<String, any Error>?

    init(
        tokenStorage: TokenStorage,
        baseURL: URL,
        session: URLSession = .shared,
        onSessionInvalidated: @MainActor @Sendable @escaping () -> Void
    ) {
        self.tokenStorage = tokenStorage
        self.baseURL = baseURL
        self.session = session
        self.onSessionInvalidated = onSessionInvalidated
    }

    /// Returns a valid access token, refreshing if necessary.
    /// Multiple concurrent callers coalesce into a single refresh request.
    func refreshIfNeeded() async throws -> String {
        if let existing = activeRefreshTask {
            return try await existing.value
        }

        let task = Task<String, any Error> { [tokenStorage, baseURL, session, onSessionInvalidated] in
            guard let refreshToken = tokenStorage.refreshToken else {
                await onSessionInvalidated()
                throw AppError.unauthorized
            }

            do {
                let request = RefreshRequest(refreshToken: refreshToken)
                let endpoint = AuthEndpoints.refresh(request)
                var urlRequest = try endpoint.urlRequest(baseURL: baseURL)
                urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

                let (data, response) = try await session.data(for: urlRequest)
                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    tokenStorage.clearAll()
                    await onSessionInvalidated()
                    throw AppError.unauthorized
                }

                let refreshResponse = try JSONDecoder.apiDecoder.decode(RefreshResponse.self, from: data)
                tokenStorage.storeSession(access: refreshResponse.token, refresh: refreshResponse.refreshToken)
                return refreshResponse.token
            } catch is AppError {
                throw AppError.unauthorized
            } catch {
                tokenStorage.clearAll()
                await onSessionInvalidated()
                throw AppError.unauthorized
            }
        }

        activeRefreshTask = task
        do {
            let token = try await task.value
            activeRefreshTask = nil
            return token
        } catch {
            activeRefreshTask = nil
            throw error
        }
    }
}
