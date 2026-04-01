import Foundation

final class UserService: UserServicing, Sendable {
    private let apiClient: APIClient
    init(apiClient: APIClient) { self.apiClient = apiClient }

    func me() async throws -> UserDTO { try await apiClient.send(UserEndpoints.me()) }

    func updateMe(name: String?, email: String?) async throws -> UserDTO {
        var body: [String: String] = [:]
        if let name { body["name"] = name }
        if let email { body["email"] = email }
        return try await apiClient.send(UserEndpoints.updateMe(body))
    }
}
