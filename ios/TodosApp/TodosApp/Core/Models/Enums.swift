import Foundation

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
    case inbox
    case next
    case inProgress = "in_progress"
    case waiting
    case scheduled
    case someday
    case done
    case cancelled

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .inbox: "Inbox"
        case .next: "Next"
        case .inProgress: "In Progress"
        case .waiting: "Waiting"
        case .scheduled: "Scheduled"
        case .someday: "Someday"
        case .done: "Done"
        case .cancelled: "Cancelled"
        }
    }

    var iconName: String {
        switch self {
        case .inbox: "tray"
        case .next: "arrow.right.circle"
        case .inProgress: "play.circle"
        case .waiting: "clock"
        case .scheduled: "calendar"
        case .someday: "sparkles"
        case .done: "checkmark.circle.fill"
        case .cancelled: "xmark.circle"
        }
    }
}

enum Priority: String, Codable, CaseIterable, Identifiable {
    case low, medium, high, urgent

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum Energy: String, Codable, CaseIterable, Identifiable {
    case low, medium, high

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum ProjectStatus: String, Codable, CaseIterable, Identifiable {
    case active
    case onHold = "on_hold"
    case completed
    case archived

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .active: "Active"
        case .onHold: "On Hold"
        case .completed: "Completed"
        case .archived: "Archived"
        }
    }
}

enum ReviewCadence: String, Codable, CaseIterable, Identifiable {
    case weekly, biweekly, monthly, quarterly

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum TaskSource: String, Codable {
    case manual
    case systemSeed = "system_seed"
    case chat, email
    case `import`
    case automation, api
}

enum TodoEmotionalState: String, Codable, CaseIterable, Identifiable {
    case avoiding, unclear, heavy, exciting, draining

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }
}

enum RecurrenceType: String, Codable {
    case none, daily, weekly, monthly, yearly, rrule
}

enum TodoSortBy: String, Codable {
    case order, createdAt, updatedAt, dueDate, priority, title
}

enum SortOrder: String, Codable {
    case asc, desc
}
