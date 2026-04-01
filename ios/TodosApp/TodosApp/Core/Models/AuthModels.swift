import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    var name: String?
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct AuthResponse: Decodable {
    let user: UserDTO
    let token: String
    let refreshToken: String?
}

struct RefreshResponse: Decodable {
    let token: String
    let refreshToken: String
}
