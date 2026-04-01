import Foundation

struct ProjectDTO: Codable, Identifiable {
    let id: String
    var name: String
    var description: String?
    var status: ProjectStatus
    var priority: Priority?
    var area: String?
    var goal: String?
    var targetDate: Date?
    var reviewCadence: ReviewCadence?
    var lastReviewedAt: Date?
    var archived: Bool
    var archivedAt: Date?
    var areaId: String?
    var goalId: String?
    let userId: String
    let createdAt: Date
    let updatedAt: Date
    var taskCount: Int?
    var openTaskCount: Int?
    var completedTaskCount: Int?
    var todoCount: Int?
    var openTodoCount: Int?
}

struct CreateProjectRequest: Encodable {
    var name: String
    var description: String?
    var status: ProjectStatus?
    var priority: Priority?
    var area: String?
    var goal: String?
    var targetDate: Date?
    var reviewCadence: ReviewCadence?
}

struct UpdateProjectRequest: Encodable {
    var name: String?
    var description: String?
    var status: ProjectStatus?
    var priority: Priority?
    var area: String?
    var goal: String?
    var targetDate: Date?
    var reviewCadence: ReviewCadence?
    var archived: Bool?
}
