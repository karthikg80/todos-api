import SwiftUI

struct TodoListView: View {
    @Environment(\.appEnvironment) private var env
    @State private var viewModel: TodoListViewModel?
    @State private var showingCreateSheet = false
    @State private var selectedTodo: TodoDTO?
    @State private var selectedStatus: TaskStatus?
    @State private var selectedPriority: Priority?

    var initialFilter: TodoListQuery

    init(initialFilter: TodoListQuery = TodoListQuery()) {
        self.initialFilter = initialFilter
    }

    var body: some View {
        Group {
            if let viewModel {
                listContent(viewModel: viewModel)
            } else {
                ProgressView()
                    .onAppear {
                        guard let env else { return }
                        viewModel = TodoListViewModel(todoService: env.todoService, initialFilter: initialFilter)
                    }
            }
        }
    }

    @ViewBuilder
    private func listContent(viewModel: TodoListViewModel) -> some View {
        VStack(spacing: 0) {
            FilterBar(selectedStatus: $selectedStatus, selectedPriority: $selectedPriority)
                .padding(.vertical, 8)
                .onChange(of: selectedStatus) { _, newValue in
                    viewModel.applyStatusFilter(newValue.map { [$0] })
                }
                .onChange(of: selectedPriority) { _, newValue in
                    viewModel.filter.priority = newValue
                    Task { await viewModel.fetchTodos() }
                }

            Group {
                switch viewModel.state {
                case .idle, .loading:
                    ProgressView().frame(maxHeight: .infinity)
                case .loaded(let todos):
                    if todos.isEmpty {
                        EmptyStateView(
                            icon: "tray",
                            title: "No tasks",
                            message: "Tap + to create your first task",
                            actionLabel: "New Task"
                        ) { showingCreateSheet = true }
                    } else {
                        List {
                            ForEach(todos) { todo in
                                TodoRowView(todo: todo) {
                                    Task { await viewModel.toggleCompleted(todo) }
                                }
                                .contentShape(Rectangle())
                                .onTapGesture { selectedTodo = todo }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteTodo(todo) }
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                                .swipeActions(edge: .leading) {
                                    Button {
                                        Task { await viewModel.toggleCompleted(todo) }
                                    } label: {
                                        Label(todo.completed ? "Undo" : "Done",
                                              systemImage: todo.completed ? "arrow.uturn.backward" : "checkmark")
                                    }
                                    .tint(.green)
                                }
                            }
                        }
                        .listStyle(.plain)
                        .refreshable { await viewModel.fetchTodos() }
                    }
                case .error(let error):
                    EmptyStateView(
                        icon: "exclamationmark.triangle",
                        title: "Error",
                        message: error.userMessage,
                        actionLabel: "Retry"
                    ) { Task { await viewModel.fetchTodos() } }
                }
            }
        }
        .searchable(text: Binding(
            get: { viewModel.searchText },
            set: { viewModel.searchText = $0 }
        ))
        .onSubmit(of: .search) { viewModel.search() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingCreateSheet = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreateSheet) {
            TodoFormView(mode: .create) { dto in
                _ = try await viewModel.createTodo(dto)
            }
        }
        .sheet(item: $selectedTodo) { todo in
            TodoDetailView(todo: todo, todoService: env!.todoService) {
                Task { await viewModel.fetchTodos() }
            }
        }
        .task { await viewModel.fetchTodos() }
    }
}
