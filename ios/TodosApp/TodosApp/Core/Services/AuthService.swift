import Foundation

final class AuthService: AuthServicing, Sendable {
    private let apiClient: APIClient
    private let tokenStorage: TokenStorage

    init(apiClient: APIClient, tokenStorage: TokenStorage) {
        self.apiClient = apiClient
        self.tokenStorage = tokenStorage
    }

    func login(email: String, password: String) async throws -> UserDTO {
        let response = try await apiClient.sendUnauthenticated(
            AuthEndpoints.login(LoginRequest(email: email, password: password))
        )
        tokenStorage.storeSession(access: response.token, refresh: response.refreshToken ?? "")
        return response.user
    }

    func register(email: String, password: String, name: String?) async throws -> UserDTO {
        let response = try await apiClient.sendUnauthenticated(
            AuthEndpoints.register(RegisterRequest(email: email, password: password, name: name))
        )
        tokenStorage.storeSession(access: response.token, refresh: response.refreshToken ?? "")
        return response.user
    }

    func restoreSession() async throws -> UserDTO {
        guard tokenStorage.refreshToken != nil else { throw AppError.unauthorized }
        return try await apiClient.send(UserEndpoints.me())
    }

    func logout() async throws {
        if let rt = tokenStorage.refreshToken {
            _ = try? await apiClient.sendUnauthenticated(AuthEndpoints.logout(rt))
        }
        tokenStorage.clearAll()
    }
}
