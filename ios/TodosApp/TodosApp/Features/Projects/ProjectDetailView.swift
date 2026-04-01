import SwiftUI

struct ProjectDetailView: View {
    let project: ProjectDTO
    let projectService: any ProjectServicing
    let todoService: any TodoServicing

    @State private var headings: [HeadingDTO] = []
    @State private var todos: [TodoDTO] = []
    @State private var isLoading = true
    @State private var showingCreateTodo = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else {
                List {
                    if let desc = project.description, !desc.isEmpty {
                        Section { Text(desc).foregroundStyle(.secondary) }
                    }

                    // Ungrouped todos (no heading)
                    let ungrouped = todos.filter { $0.headingId == nil }
                    if !ungrouped.isEmpty {
                        Section("Tasks") {
                            ForEach(ungrouped) { todo in
                                TodoRowView(todo: todo) {}
                            }
                        }
                    }

                    // Grouped by heading
                    ForEach(headings.sorted(by: { $0.sortOrder < $1.sortOrder })) { heading in
                        Section(heading.name) {
                            let grouped = todos.filter { $0.headingId == heading.id }
                            if grouped.isEmpty {
                                Text("No tasks").foregroundStyle(.secondary).font(.caption)
                            } else {
                                ForEach(grouped) { todo in
                                    TodoRowView(todo: todo) {}
                                }
                            }
                        }
                    }
                }
                .refreshable { await loadData() }
            }
        }
        .navigationTitle(project.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingCreateTodo = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingCreateTodo) {
            TodoFormView(mode: .create) { dto in
                var req = dto
                req.projectId = project.id
                _ = try await todoService.create(req)
                await loadData()
            }
        }
        .task { await loadData() }
    }

    private func loadData() async {
        isLoading = true
        async let h = projectService.listHeadings(projectId: project.id)
        async let t = todoService.list(filter: TodoListQuery(projectId: project.id, archived: false))
        do {
            headings = try await h
            todos = try await t
        } catch {}
        isLoading = false
    }
}
