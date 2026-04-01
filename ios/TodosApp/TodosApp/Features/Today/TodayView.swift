import SwiftUI

struct TodayView: View {
    @Environment(\.appEnvironment) private var env
    @State private var viewModel: TodayViewModel?

    var body: some View {
        NavigationStack {
            Group {
                if let viewModel {
                    todayContent(viewModel: viewModel)
                } else {
                    ProgressView().onAppear {
                        guard let env else { return }
                        viewModel = TodayViewModel(todoService: env.todoService)
                    }
                }
            }
            .navigationTitle("Today")
        }
    }

    @ViewBuilder
    private func todayContent(viewModel: TodayViewModel) -> some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView().frame(maxHeight: .infinity)
        case .loaded:
            if viewModel.isEmpty {
                EmptyStateView(icon: "sun.max", title: "All clear", message: "Nothing due or scheduled for today")
            } else {
                List {
                    if !viewModel.overdueTodos.isEmpty {
                        Section {
                            ForEach(viewModel.overdueTodos) { todo in
                                TodoRowView(todo: todo) {}
                            }
                        } header: {
                            Label("Overdue", systemImage: "exclamationmark.triangle")
                                .foregroundStyle(.red)
                        }
                    }
                    if !viewModel.dueTodayTodos.isEmpty {
                        Section("Due Today") {
                            ForEach(viewModel.dueTodayTodos) { todo in
                                TodoRowView(todo: todo) {}
                            }
                        }
                    }
                    if !viewModel.scheduledTodayTodos.isEmpty {
                        Section("Scheduled") {
                            ForEach(viewModel.scheduledTodayTodos) { todo in
                                TodoRowView(todo: todo) {}
                            }
                        }
                    }
                }
                .refreshable { await viewModel.fetchToday() }
            }
        case .error(let error):
            EmptyStateView(icon: "exclamationmark.triangle", title: "Error", message: error.userMessage,
                           actionLabel: "Retry") { Task { await viewModel.fetchToday() } }
        }
    }
}
