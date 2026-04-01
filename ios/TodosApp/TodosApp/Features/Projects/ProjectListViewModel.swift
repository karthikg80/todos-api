import Foundation
import Observation

@MainActor
@Observable
final class ProjectListViewModel {
    var state: ViewState<[ProjectDTO]> = .idle
    private let projectService: any ProjectServicing

    init(projectService: any ProjectServicing) { self.projectService = projectService }

    var projects: [ProjectDTO] { state.value ?? [] }
    var activeProjects: [ProjectDTO] { projects.filter { $0.status == .active && !$0.archived } }
    var onHoldProjects: [ProjectDTO] { projects.filter { $0.status == .onHold && !$0.archived } }
    var completedProjects: [ProjectDTO] { projects.filter { $0.status == .completed && !$0.archived } }

    func fetchProjects() async {
        state = .loading
        do { state = .loaded(try await projectService.list()) }
        catch let e as AppError { state = .error(e) }
        catch { state = .error(.network(URLError(.unknown))) }
    }

    func createProject(_ dto: CreateProjectRequest) async throws -> ProjectDTO {
        let created = try await projectService.create(dto)
        if case .loaded(var list) = state { list.insert(created, at: 0); state = .loaded(list) }
        return created
    }

    func deleteProject(_ project: ProjectDTO) async {
        let previous = projects
        if case .loaded(var list) = state { list.removeAll { $0.id == project.id }; state = .loaded(list) }
        do { try await projectService.delete(project.id, taskDisposition: "unsorted") }
        catch { state = .loaded(previous) }
    }
}
