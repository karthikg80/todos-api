import Foundation

final class TodoService: TodoServicing, Sendable {
    private let apiClient: APIClient
    init(apiClient: APIClient) { self.apiClient = apiClient }

    func list(filter: TodoListQuery) async throws -> [TodoDTO] {
        try await apiClient.send(TodoEndpoints.list(query: filter))
    }
    func get(id: String) async throws -> TodoDTO {
        try await apiClient.send(TodoEndpoints.get(id: id))
    }
    func create(_ dto: CreateTodoRequest) async throws -> TodoDTO {
        try await apiClient.send(TodoEndpoints.create(dto))
    }
    func update(_ id: String, _ dto: UpdateTodoRequest) async throws -> TodoDTO {
        try await apiClient.send(TodoEndpoints.update(id: id, dto))
    }
    func delete(_ id: String) async throws {
        _ = try await apiClient.send(TodoEndpoints.delete(id: id))
    }
    func reorder(_ items: [ReorderTodoItem]) async throws -> [TodoDTO] {
        try await apiClient.send(TodoEndpoints.reorder(items))
    }
    func createSubtask(todoId: String, _ dto: CreateSubtaskRequest) async throws -> SubtaskDTO {
        try await apiClient.send(TodoEndpoints.createSubtask(todoId: todoId, dto))
    }
    func updateSubtask(todoId: String, subtaskId: String, _ dto: UpdateSubtaskRequest) async throws -> SubtaskDTO {
        try await apiClient.send(TodoEndpoints.updateSubtask(todoId: todoId, subtaskId: subtaskId, dto))
    }
    func deleteSubtask(todoId: String, subtaskId: String) async throws {
        _ = try await apiClient.send(TodoEndpoints.deleteSubtask(todoId: todoId, subtaskId: subtaskId))
    }
}
