import Foundation
import Observation

@MainActor
@Observable
final class TodoListViewModel {
    var state: ViewState<[TodoDTO]> = .idle
    var filter: TodoListQuery
    var searchText = ""

    private let todoService: any TodoServicing

    init(todoService: any TodoServicing, initialFilter: TodoListQuery = TodoListQuery()) {
        self.todoService = todoService
        self.filter = initialFilter
    }

    var todos: [TodoDTO] { state.value ?? [] }

    func fetchTodos() async {
        state = .loading
        var query = filter
        if !searchText.isEmpty { query.search = searchText }
        do {
            state = .loaded(try await todoService.list(filter: query))
        } catch let error as AppError {
            state = .error(error)
        } catch {
            state = .error(.network(URLError(.unknown)))
        }
    }

    // Optimistic toggle
    func toggleCompleted(_ todo: TodoDTO) async {
        let previous = todos
        let newCompleted = !todo.completed
        let newStatus: TaskStatus = newCompleted ? .done : .inbox
        updateLocal(id: todo.id) { $0.completed = newCompleted; $0.status = newStatus }
        do {
            _ = try await todoService.update(todo.id, UpdateTodoRequest(status: newStatus, completed: newCompleted))
        } catch { state = .loaded(previous) }
    }

    // Optimistic delete
    func deleteTodo(_ todo: TodoDTO) async {
        let previous = todos
        if case .loaded(var list) = state { list.removeAll { $0.id == todo.id }; state = .loaded(list) }
        do { try await todoService.delete(todo.id) }
        catch { state = .loaded(previous) }
    }

    // Non-optimistic create
    func createTodo(_ dto: CreateTodoRequest) async throws -> TodoDTO {
        let created = try await todoService.create(dto)
        if case .loaded(var list) = state { list.insert(created, at: 0); state = .loaded(list) }
        return created
    }

    // Non-optimistic update
    func updateTodo(_ id: String, _ dto: UpdateTodoRequest) async throws -> TodoDTO {
        let updated = try await todoService.update(id, dto)
        updateLocal(id: id) { $0 = updated }
        return updated
    }

    func applyStatusFilter(_ statuses: [TaskStatus]?) {
        filter.statuses = statuses
        Task { await fetchTodos() }
    }

    func search() { Task { await fetchTodos() } }

    private func updateLocal(id: String, transform: (inout TodoDTO) -> Void) {
        if case .loaded(var list) = state, let i = list.firstIndex(where: { $0.id == id }) {
            transform(&list[i]); state = .loaded(list)
        }
    }
}
