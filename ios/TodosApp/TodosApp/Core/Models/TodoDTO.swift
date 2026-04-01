import Foundation

struct TodoRecurrence: Codable {
    var type: RecurrenceType
    var interval: Int?
    var rrule: String?
    var nextOccurrence: Date?
}

struct TodoDTO: Codable, Identifiable {
    let id: String
    var title: String
    var description: String?
    var status: TaskStatus
    var completed: Bool
    var projectId: String?
    var category: String?
    var tags: [String]
    var context: String?
    var energy: Energy?
    var headingId: String?
    var dueDate: Date?
    var startDate: Date?
    var scheduledDate: Date?
    var reviewDate: Date?
    var completedAt: Date?
    var estimateMinutes: Int?
    var waitingOn: String?
    var dependsOnTaskIds: [String]
    var order: Int
    var priority: Priority?
    var archived: Bool
    var recurrence: TodoRecurrence
    var source: TaskSource?
    var doDate: Date?
    var blockedReason: String?
    var effortScore: Double?
    var confidenceScore: Double?
    var firstStep: String?
    var emotionalState: TodoEmotionalState?
    var sourceText: String?
    var areaId: String?
    var goalId: String?
    var createdByPrompt: String?
    var notes: String?
    let userId: String
    let createdAt: Date
    let updatedAt: Date
    var subtasks: [SubtaskDTO]?
}

// MARK: - Lightweight projections

extension TodoDTO {
    var isOverdue: Bool {
        guard let dueDate, !completed else { return false }
        return dueDate < Calendar.current.startOfDay(for: Date())
    }

    var subtaskProgress: String? {
        guard let subs = subtasks, !subs.isEmpty else { return nil }
        return "\(subs.filter(\.completed).count)/\(subs.count)"
    }
}

// MARK: - Request DTOs

struct CreateTodoRequest: Encodable {
    var title: String
    var description: String?
    var status: TaskStatus?
    var completed: Bool?
    var projectId: String?
    var category: String?
    var headingId: String?
    var dueDate: Date?
    var startDate: Date?
    var scheduledDate: Date?
    var reviewDate: Date?
    var priority: Priority?
    var tags: [String]?
    var context: String?
    var energy: Energy?
    var estimateMinutes: Int?
    var waitingOn: String?
    var dependsOnTaskIds: [String]?
    var notes: String?
}

struct UpdateTodoRequest: Encodable {
    var title: String?
    var description: String?
    var status: TaskStatus?
    var completed: Bool?
    var projectId: String?
    var category: String?
    var headingId: String?
    var dueDate: Date?
    var startDate: Date?
    var scheduledDate: Date?
    var reviewDate: Date?
    var order: Int?
    var priority: Priority?
    var tags: [String]?
    var context: String?
    var energy: Energy?
    var estimateMinutes: Int?
    var waitingOn: String?
    var dependsOnTaskIds: [String]?
    var archived: Bool?
    var notes: String?
}

struct ReorderTodoItem: Encodable {
    let id: String
    let order: Int
    var headingId: String?
}

struct TodoListQuery {
    var completed: Bool?
    var priority: Priority?
    var statuses: [TaskStatus]?
    var category: String?
    var search: String?
    var projectId: String?
    var unsorted: Bool?
    var needsOrganizing: Bool?
    var archived: Bool?
    var dueDateFrom: Date?
    var dueDateTo: Date?
    var scheduledDateFrom: Date?
    var scheduledDateTo: Date?
    var sortBy: TodoSortBy?
    var sortOrder: SortOrder?
    var page: Int?
    var limit: Int?
}
