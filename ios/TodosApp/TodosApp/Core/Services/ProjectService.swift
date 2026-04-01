import Foundation

final class ProjectService: ProjectServicing, Sendable {
    private let apiClient: APIClient
    init(apiClient: APIClient) { self.apiClient = apiClient }

    func list() async throws -> [ProjectDTO] { try await apiClient.send(ProjectEndpoints.list()) }
    func get(id: String) async throws -> ProjectDTO { try await apiClient.send(ProjectEndpoints.get(id: id)) }
    func create(_ dto: CreateProjectRequest) async throws -> ProjectDTO { try await apiClient.send(ProjectEndpoints.create(dto)) }
    func update(_ id: String, _ dto: UpdateProjectRequest) async throws -> ProjectDTO { try await apiClient.send(ProjectEndpoints.update(id: id, dto)) }
    func delete(_ id: String, taskDisposition: String) async throws { _ = try await apiClient.send(ProjectEndpoints.delete(id: id, taskDisposition: taskDisposition)) }
    func listHeadings(projectId: String) async throws -> [HeadingDTO] { try await apiClient.send(ProjectEndpoints.listHeadings(projectId: projectId)) }
    func createHeading(projectId: String, _ dto: CreateHeadingRequest) async throws -> HeadingDTO { try await apiClient.send(ProjectEndpoints.createHeading(projectId: projectId, dto)) }
    func reorderHeadings(projectId: String, _ items: [ReorderHeadingItem]) async throws -> [HeadingDTO] { try await apiClient.send(ProjectEndpoints.reorderHeadings(projectId: projectId, items)) }
}
