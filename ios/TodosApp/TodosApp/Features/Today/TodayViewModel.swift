import Foundation
import Observation

@MainActor
@Observable
final class TodayViewModel {
    var state: ViewState<[TodoDTO]> = .idle
    private let todoService: any TodoServicing

    init(todoService: any TodoServicing) { self.todoService = todoService }

    var allTodos: [TodoDTO] { state.value ?? [] }

    // Bucket precedence: overdue > due today > scheduled today
    var overdueTodos: [TodoDTO] {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        return allTodos.filter { !$0.completed && ($0.dueDate.map { $0 < startOfToday } ?? false) }
    }

    var dueTodayTodos: [TodoDTO] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let overdueIds = Set(overdueTodos.map(\.id))
        return allTodos.filter { todo in
            guard !todo.completed, !overdueIds.contains(todo.id) else { return false }
            guard let due = todo.dueDate else { return false }
            return cal.isDate(due, inSameDayAs: today)
        }
    }

    var scheduledTodayTodos: [TodoDTO] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let usedIds = Set(overdueTodos.map(\.id) + dueTodayTodos.map(\.id))
        return allTodos.filter { todo in
            guard !todo.completed, !usedIds.contains(todo.id) else { return false }
            guard let sched = todo.scheduledDate else { return false }
            return cal.isDate(sched, inSameDayAs: today)
        }
    }

    var isEmpty: Bool { overdueTodos.isEmpty && dueTodayTodos.isEmpty && scheduledTodayTodos.isEmpty }

    func fetchToday() async {
        state = .loading
        let cal = Calendar.current
        let startOfToday = cal.startOfDay(for: Date())
        let endOfToday = cal.date(byAdding: .day, value: 1, to: startOfToday)!

        // Fetch overdue + due today + scheduled today in one call
        var query = TodoListQuery()
        query.completed = false
        query.archived = false
        query.dueDateTo = endOfToday
        query.limit = 100

        do {
            var todos = try await todoService.list(filter: query)

            // Also fetch scheduled-today todos (separate query since scheduledDate != dueDate)
            var schedQuery = TodoListQuery()
            schedQuery.completed = false
            schedQuery.archived = false
            schedQuery.scheduledDateFrom = startOfToday
            schedQuery.scheduledDateTo = endOfToday
            schedQuery.limit = 100

            let scheduled = try await todoService.list(filter: schedQuery)

            // Merge without duplicates
            let existing = Set(todos.map(\.id))
            for t in scheduled where !existing.contains(t.id) { todos.append(t) }

            state = .loaded(todos)
        } catch let e as AppError {
            state = .error(e)
        } catch {
            state = .error(.network(URLError(.unknown)))
        }
    }
}
