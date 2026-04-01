import Foundation

protocol AuthServicing: Sendable {
    func login(email: String, password: String) async throws -> UserDTO
    func register(email: String, password: String, name: String?) async throws -> UserDTO
    func restoreSession() async throws -> UserDTO
    func logout() async throws
}

protocol TodoServicing: Sendable {
    func list(filter: TodoListQuery) async throws -> [TodoDTO]
    func get(id: String) async throws -> TodoDTO
    func create(_ dto: CreateTodoRequest) async throws -> TodoDTO
    func update(_ id: String, _ dto: UpdateTodoRequest) async throws -> TodoDTO
    func delete(_ id: String) async throws
    func reorder(_ items: [ReorderTodoItem]) async throws -> [TodoDTO]
    func createSubtask(todoId: String, _ dto: CreateSubtaskRequest) async throws -> SubtaskDTO
    func updateSubtask(todoId: String, subtaskId: String, _ dto: UpdateSubtaskRequest) async throws -> SubtaskDTO
    func deleteSubtask(todoId: String, subtaskId: String) async throws
}

protocol ProjectServicing: Sendable {
    func list() async throws -> [ProjectDTO]
    func get(id: String) async throws -> ProjectDTO
    func create(_ dto: CreateProjectRequest) async throws -> ProjectDTO
    func update(_ id: String, _ dto: UpdateProjectRequest) async throws -> ProjectDTO
    func delete(_ id: String, taskDisposition: String) async throws
    func listHeadings(projectId: String) async throws -> [HeadingDTO]
    func createHeading(projectId: String, _ dto: CreateHeadingRequest) async throws -> HeadingDTO
    func reorderHeadings(projectId: String, _ items: [ReorderHeadingItem]) async throws -> [HeadingDTO]
}

protocol UserServicing: Sendable {
    func me() async throws -> UserDTO
    func updateMe(name: String?, email: String?) async throws -> UserDTO
}
