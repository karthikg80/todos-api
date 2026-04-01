import Foundation

actor APIClient {
    private let baseURL: URL
    private let tokenStorage: TokenStorage
    private let sessionCoordinator: SessionCoordinator
    private let session: URLSession

    init(
        baseURL: URL,
        tokenStorage: TokenStorage,
        sessionCoordinator: SessionCoordinator,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.tokenStorage = tokenStorage
        self.sessionCoordinator = sessionCoordinator
        self.session = session
    }

    // MARK: - Authenticated (attaches Bearer, retries once on 401)

    func send<T: Decodable>(_ endpoint: APIRequest<T>) async throws -> T {
        var urlRequest = try endpoint.urlRequest(baseURL: baseURL)
        if let token = tokenStorage.accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await performRequest(urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw AppError.network(URLError(.badServerResponse))
        }

        if http.statusCode == 401 {
            let newToken = try await sessionCoordinator.refreshIfNeeded()
            var retry = try endpoint.urlRequest(baseURL: baseURL)
            retry.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
            let (retryData, retryResp) = try await performRequest(retry)
            guard let retryHttp = retryResp as? HTTPURLResponse else {
                throw AppError.network(URLError(.badServerResponse))
            }
            return try handleResponse(data: retryData, response: retryHttp)
        }

        return try handleResponse(data: data, response: http)
    }

    // MARK: - Unauthenticated (no Bearer, no retry — login, register, refresh)

    func sendUnauthenticated<T: Decodable>(_ endpoint: APIRequest<T>) async throws -> T {
        let urlRequest = try endpoint.urlRequest(baseURL: baseURL)
        let (data, response) = try await performRequest(urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw AppError.network(URLError(.badServerResponse))
        }
        return try handleResponse(data: data, response: http)
    }

    // MARK: - Response handling

    private func handleResponse<T: Decodable>(data: Data, response: HTTPURLResponse) throws -> T {
        switch response.statusCode {
        case 200...299:
            if T.self == EmptyResponse.self { return EmptyResponse() as! T }
            do {
                return try JSONDecoder.apiDecoder.decode(T.self, from: data)
            } catch {
                #if DEBUG
                print("[APIClient] Decoding error: \(error)")
                if let raw = String(data: data, encoding: .utf8) {
                    print("[APIClient] Raw response: \(raw.prefix(500))")
                }
                #endif
                throw AppError.decodingFailed(error.localizedDescription)
            }
        case 400:
            let errorBody = try? JSONDecoder.apiDecoder.decode(ValidationErrorBody.self, from: data)
            if let errors = errorBody?.errors {
                throw AppError.validationFailed(errors)
            }
            let msg = (try? JSONDecoder.apiDecoder.decode(ErrorBody.self, from: data))?.error
            throw AppError.validationFailed([msg ?? "Invalid request"])
        case 401:
            throw AppError.unauthorized
        default:
            let msg = (try? JSONDecoder.apiDecoder.decode(ErrorBody.self, from: data))?.error
            throw AppError.serverError(statusCode: response.statusCode, message: msg)
        }
    }

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            throw AppError.network(error)
        }
    }
}

private struct ErrorBody: Decodable { let error: String }
private struct ValidationErrorBody: Decodable { let errors: [String]? }
