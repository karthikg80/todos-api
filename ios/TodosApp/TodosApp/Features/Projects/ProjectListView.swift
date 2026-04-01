import SwiftUI

struct ProjectListView: View {
    @Environment(\.appEnvironment) private var env
    @State private var viewModel: ProjectListViewModel?
    @State private var showingCreate = false

    var body: some View {
        NavigationStack {
            Group {
                if let viewModel {
                    projectList(viewModel: viewModel)
                } else {
                    ProgressView().onAppear {
                        guard let env else { return }
                        viewModel = ProjectListViewModel(projectService: env.projectService)
                    }
                }
            }
            .navigationTitle("Projects")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingCreate = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingCreate) {
                ProjectFormView { dto in
                    _ = try await viewModel?.createProject(dto)
                }
            }
        }
    }

    @ViewBuilder
    private func projectList(viewModel: ProjectListViewModel) -> some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView().frame(maxHeight: .infinity)
        case .loaded:
            if viewModel.projects.isEmpty {
                EmptyStateView(icon: "folder", title: "No projects", message: "Create a project to organize your tasks",
                               actionLabel: "New Project") { showingCreate = true }
            } else {
                List {
                    if !viewModel.activeProjects.isEmpty {
                        Section("Active") {
                            ForEach(viewModel.activeProjects) { project in
                                projectRow(project, viewModel: viewModel)
                            }
                        }
                    }
                    if !viewModel.onHoldProjects.isEmpty {
                        Section("On Hold") {
                            ForEach(viewModel.onHoldProjects) { project in
                                projectRow(project, viewModel: viewModel)
                            }
                        }
                    }
                    if !viewModel.completedProjects.isEmpty {
                        Section("Completed") {
                            ForEach(viewModel.completedProjects) { project in
                                projectRow(project, viewModel: viewModel)
                            }
                        }
                    }
                }
                .refreshable { await viewModel.fetchProjects() }
            }
        case .error(let error):
            EmptyStateView(icon: "exclamationmark.triangle", title: "Error", message: error.userMessage,
                           actionLabel: "Retry") { Task { await viewModel.fetchProjects() } }
        }
    }

    @ViewBuilder
    private func projectRow(_ project: ProjectDTO, viewModel: ProjectListViewModel) -> some View {
        NavigationLink {
            if let env {
                ProjectDetailView(project: project, projectService: env.projectService, todoService: env.todoService)
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(project.name).font(.body)
                HStack(spacing: 8) {
                    if let count = project.openTaskCount {
                        Text("\(count) open").font(.caption).foregroundStyle(.secondary)
                    }
                    PriorityBadge(priority: project.priority)
                }
            }
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await viewModel.deleteProject(project) }
            } label: { Label("Delete", systemImage: "trash") }
        }
    }
}
