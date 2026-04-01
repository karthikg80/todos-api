import Foundation

struct UserDTO: Codable, Identifiable {
    let id: String
    var email: String
    var name: String?
}
