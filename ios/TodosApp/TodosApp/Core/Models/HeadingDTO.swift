import Foundation

struct HeadingDTO: Codable, Identifiable {
    let id: String
    let projectId: String
    var name: String
    var sortOrder: Int
    let createdAt: Date
    let updatedAt: Date
}

struct CreateHeadingRequest: Encodable {
    let name: String
}

struct ReorderHeadingItem: Encodable {
    let id: String
    let sortOrder: Int
}
