import XCTest
@testable import TodosApp

final class ModelDecodingTests: XCTestCase {

    func testDecodeTodoAllFields() throws {
        let json = """
        {"id":"abc-123","title":"Buy groceries","description":"Weekly shopping","status":"next",
        "completed":false,"projectId":"proj-1","category":"personal","tags":["shopping","weekly"],
        "context":"@errands","energy":"low","dueDate":"2024-12-25T00:00:00.000Z",
        "estimateMinutes":30,"waitingOn":null,"dependsOnTaskIds":[],"order":1,"priority":"medium",
        "archived":false,"recurrence":{"type":"weekly","interval":1},"source":"manual",
        "firstStep":"Check pantry","emotionalState":"exciting",
        "userId":"user-1","createdAt":"2024-01-15T10:30:00.000Z","updatedAt":"2024-01-15T10:30:00.500Z",
        "subtasks":[{"id":"sub-1","title":"Get milk","completed":true,"order":0,
        "completedAt":"2024-01-16T09:00:00.000Z","todoId":"abc-123",
        "createdAt":"2024-01-15T10:30:00.000Z","updatedAt":"2024-01-16T09:00:00.000Z"}]}
        """.data(using: .utf8)!

        let todo = try JSONDecoder.apiDecoder.decode(TodoDTO.self, from: json)
        XCTAssertEqual(todo.id, "abc-123")
        XCTAssertEqual(todo.status, .next)
        XCTAssertEqual(todo.priority, .medium)
        XCTAssertEqual(todo.energy, .low)
        XCTAssertEqual(todo.firstStep, "Check pantry")
        XCTAssertEqual(todo.emotionalState, .exciting)
        XCTAssertEqual(todo.recurrence.type, .weekly)
        XCTAssertEqual(todo.subtasks?.count, 1)
    }

    func testDecodeTodoMinimal() throws {
        let json = """
        {"id":"min-1","title":"Minimal","status":"inbox","completed":false,"tags":[],
        "dependsOnTaskIds":[],"order":0,"archived":false,"recurrence":{"type":"none"},
        "userId":"u1","createdAt":"2024-01-15T10:30:00Z","updatedAt":"2024-01-15T10:30:00Z"}
        """.data(using: .utf8)!

        let todo = try JSONDecoder.apiDecoder.decode(TodoDTO.self, from: json)
        XCTAssertEqual(todo.status, .inbox)
        XCTAssertNil(todo.priority)
        XCTAssertNil(todo.firstStep)
        XCTAssertNil(todo.emotionalState)
    }

    func testDecodeAllStatuses() throws {
        let cases: [(String, TaskStatus)] = [
            ("inbox", .inbox), ("next", .next), ("in_progress", .inProgress),
            ("waiting", .waiting), ("scheduled", .scheduled), ("someday", .someday),
            ("done", .done), ("cancelled", .cancelled),
        ]
        for (raw, expected) in cases {
            let decoded = try JSONDecoder().decode(TaskStatus.self, from: "\"\(raw)\"".data(using: .utf8)!)
            XCTAssertEqual(decoded, expected)
        }
    }

    func testDecodeProject() throws {
        let json = """
        {"id":"p1","name":"Home Reno","status":"on_hold","priority":"high","archived":false,
        "userId":"u1","createdAt":"2024-01-01T00:00:00.000Z","updatedAt":"2024-06-15T12:00:00.000Z",
        "taskCount":10,"openTaskCount":7}
        """.data(using: .utf8)!
        let project = try JSONDecoder.apiDecoder.decode(ProjectDTO.self, from: json)
        XCTAssertEqual(project.status, .onHold)
        XCTAssertEqual(project.priority, .high)
        XCTAssertEqual(project.taskCount, 10)
    }

    func testDateFractionalSeconds() throws {
        let date = try JSONDecoder.apiDecoder.decode(Date.self, from: "\"2024-12-25T15:30:45.123Z\"".data(using: .utf8)!)
        let c = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "UTC")!, from: date)
        XCTAssertEqual(c.year, 2024)
        XCTAssertEqual(c.month, 12)
        XCTAssertEqual(c.hour, 15)
    }

    func testDecodeSystemSeedSource() throws {
        let decoded = try JSONDecoder().decode(TaskSource.self, from: "\"system_seed\"".data(using: .utf8)!)
        XCTAssertEqual(decoded, .systemSeed)
    }

    func testDecodeEmotionalStates() throws {
        for state in TodoEmotionalState.allCases {
            let decoded = try JSONDecoder().decode(TodoEmotionalState.self, from: "\"\(state.rawValue)\"".data(using: .utf8)!)
            XCTAssertEqual(decoded, state)
        }
    }
}
