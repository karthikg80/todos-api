import Foundation
@testable import TodosApp

final class MockAuthService: AuthServicing, @unchecked Sendable {
    var loginResult: Result<UserDTO, Error> = .failure(AppError.unauthorized)
    var registerResult: Result<UserDTO, Error> = .failure(AppError.unauthorized)
    var restoreResult: Result<UserDTO, Error> = .failure(AppError.unauthorized)
    var logoutCalled = false

    func login(email: String, password: String) async throws -> UserDTO { try loginResult.get() }
    func register(email: String, password: String, name: String?) async throws -> UserDTO { try registerResult.get() }
    func restoreSession() async throws -> UserDTO { try restoreResult.get() }
    func logout() async throws { logoutCalled = true }
}

final class MockTodoService: TodoServicing, @unchecked Sendable {
    var listResult: Result<[TodoDTO], Error> = .success([])
    var createResult: Result<TodoDTO, Error>?
    var updateResult: Result<TodoDTO, Error>?
    var deleteError: Error?

    func list(filter: TodoListQuery) async throws -> [TodoDTO] { try listResult.get() }
    func get(id: String) async throws -> TodoDTO { fatalError("Not mocked") }
    func create(_ dto: CreateTodoRequest) async throws -> TodoDTO { try createResult!.get() }
    func update(_ id: String, _ dto: UpdateTodoRequest) async throws -> TodoDTO { try updateResult!.get() }
    func delete(_ id: String) async throws { if let e = deleteError { throw e } }
    func reorder(_ items: [ReorderTodoItem]) async throws -> [TodoDTO] { [] }
    func createSubtask(todoId: String, _ dto: CreateSubtaskRequest) async throws -> SubtaskDTO { fatalError() }
    func updateSubtask(todoId: String, subtaskId: String, _ dto: UpdateSubtaskRequest) async throws -> SubtaskDTO { fatalError() }
    func deleteSubtask(todoId: String, subtaskId: String) async throws { fatalError() }
}

final class MockProjectService: ProjectServicing, @unchecked Sendable {
    func list() async throws -> [ProjectDTO] { [] }
    func get(id: String) async throws -> ProjectDTO { fatalError() }
    func create(_ dto: CreateProjectRequest) async throws -> ProjectDTO { fatalError() }
    func update(_ id: String, _ dto: UpdateProjectRequest) async throws -> ProjectDTO { fatalError() }
    func delete(_ id: String, taskDisposition: String) async throws {}
    func listHeadings(projectId: String) async throws -> [HeadingDTO] { [] }
    func createHeading(projectId: String, _ dto: CreateHeadingRequest) async throws -> HeadingDTO { fatalError() }
    func reorderHeadings(projectId: String, _ items: [ReorderHeadingItem]) async throws -> [HeadingDTO] { fatalError() }
}

final class MockUserService: UserServicing, @unchecked Sendable {
    func me() async throws -> UserDTO { fatalError() }
    func updateMe(name: String?, email: String?) async throws -> UserDTO { fatalError() }
}
