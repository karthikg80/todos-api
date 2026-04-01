import Foundation

struct SubtaskDTO: Codable, Identifiable {
    let id: String
    var title: String
    var completed: Bool
    var order: Int
    var completedAt: Date?
    let todoId: String
    let createdAt: Date
    let updatedAt: Date
}

struct CreateSubtaskRequest: Encodable {
    let title: String
}

struct UpdateSubtaskRequest: Encodable {
    var title: String?
    var completed: Bool?
    var order: Int?
}
