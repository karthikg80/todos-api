import Foundation

enum HTTPMethod: String {
    case GET, POST, PUT, DELETE
}

struct APIRequest<Response: Decodable> {
    let method: HTTPMethod
    let path: String
    var body: (any Encodable)?
    var queryItems: [(String, String?)]?

    func urlRequest(baseURL: URL) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true)!
        if let queryItems {
            components.setQueryItems(from: queryItems)
        }
        guard let url = components.url else {
            throw AppError.network(URLError(.badURL))
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 15
        if let body {
            request.httpBody = try JSONEncoder.apiEncoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }
}

// MARK: - Auth

enum AuthEndpoints {
    static func login(_ req: LoginRequest) -> APIRequest<AuthResponse> {
        APIRequest(method: .POST, path: "/auth/login", body: req)
    }
    static func register(_ req: RegisterRequest) -> APIRequest<AuthResponse> {
        APIRequest(method: .POST, path: "/auth/register", body: req)
    }
    static func refresh(_ req: RefreshRequest) -> APIRequest<RefreshResponse> {
        APIRequest(method: .POST, path: "/auth/refresh", body: req)
    }
    static func logout(_ refreshToken: String) -> APIRequest<EmptyResponse> {
        APIRequest(method: .POST, path: "/auth/logout", body: ["refreshToken": refreshToken])
    }
}

// MARK: - Users

enum UserEndpoints {
    static func me() -> APIRequest<UserDTO> {
        APIRequest(method: .GET, path: "/users/me")
    }
    static func updateMe(_ body: [String: String]) -> APIRequest<UserDTO> {
        APIRequest(method: .PUT, path: "/users/me", body: body)
    }
}

// MARK: - Todos

enum TodoEndpoints {
    static func list(query: TodoListQuery) -> APIRequest<[TodoDTO]> {
        APIRequest(method: .GET, path: "/todos", queryItems: query.queryItems)
    }
    static func get(id: String) -> APIRequest<TodoDTO> {
        APIRequest(method: .GET, path: "/todos/\(id)")
    }
    static func create(_ req: CreateTodoRequest) -> APIRequest<TodoDTO> {
        APIRequest(method: .POST, path: "/todos", body: req)
    }
    static func update(id: String, _ req: UpdateTodoRequest) -> APIRequest<TodoDTO> {
        APIRequest(method: .PUT, path: "/todos/\(id)", body: req)
    }
    static func delete(id: String) -> APIRequest<EmptyResponse> {
        APIRequest(method: .DELETE, path: "/todos/\(id)")
    }
    static func reorder(_ items: [ReorderTodoItem]) -> APIRequest<[TodoDTO]> {
        APIRequest(method: .POST, path: "/todos/reorder", body: items)
    }
    static func createSubtask(todoId: String, _ req: CreateSubtaskRequest) -> APIRequest<SubtaskDTO> {
        APIRequest(method: .POST, path: "/todos/\(todoId)/subtasks", body: req)
    }
    static func updateSubtask(todoId: String, subtaskId: String, _ req: UpdateSubtaskRequest) -> APIRequest<SubtaskDTO> {
        APIRequest(method: .PUT, path: "/todos/\(todoId)/subtasks/\(subtaskId)", body: req)
    }
    static func deleteSubtask(todoId: String, subtaskId: String) -> APIRequest<EmptyResponse> {
        APIRequest(method: .DELETE, path: "/todos/\(todoId)/subtasks/\(subtaskId)")
    }
}

// MARK: - Projects

enum ProjectEndpoints {
    static func list() -> APIRequest<[ProjectDTO]> {
        APIRequest(method: .GET, path: "/projects")
    }
    static func get(id: String) -> APIRequest<ProjectDTO> {
        APIRequest(method: .GET, path: "/projects/\(id)")
    }
    static func create(_ req: CreateProjectRequest) -> APIRequest<ProjectDTO> {
        APIRequest(method: .POST, path: "/projects", body: req)
    }
    static func update(id: String, _ req: UpdateProjectRequest) -> APIRequest<ProjectDTO> {
        APIRequest(method: .PUT, path: "/projects/\(id)", body: req)
    }
    static func delete(id: String, taskDisposition: String = "unsorted") -> APIRequest<EmptyResponse> {
        APIRequest(method: .DELETE, path: "/projects/\(id)", queryItems: [("taskDisposition", taskDisposition)])
    }
    static func listHeadings(projectId: String) -> APIRequest<[HeadingDTO]> {
        APIRequest(method: .GET, path: "/projects/\(projectId)/headings")
    }
    static func createHeading(projectId: String, _ req: CreateHeadingRequest) -> APIRequest<HeadingDTO> {
        APIRequest(method: .POST, path: "/projects/\(projectId)/headings", body: req)
    }
    static func reorderHeadings(projectId: String, _ items: [ReorderHeadingItem]) -> APIRequest<[HeadingDTO]> {
        APIRequest(method: .PUT, path: "/projects/\(projectId)/headings/reorder", body: items)
    }
}

// MARK: - Helpers

struct EmptyResponse: Decodable {}

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void
    init(_ wrapped: any Encodable) {
        _encode = { try wrapped.encode(to: $0) }
    }
    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
