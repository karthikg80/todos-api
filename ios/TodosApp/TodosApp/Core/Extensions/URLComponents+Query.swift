import Foundation

extension URLComponents {
    mutating func setQueryItems(from parameters: [(String, String?)]) {
        let items = parameters.compactMap { key, value -> URLQueryItem? in
            guard let value else { return nil }
            return URLQueryItem(name: key, value: value)
        }
        queryItems = items.isEmpty ? nil : items
    }
}

extension TodoListQuery {
    var queryItems: [(String, String?)] {
        var items: [(String, String?)] = []
        if let completed { items.append(("completed", String(completed))) }
        if let priority { items.append(("priority", priority.rawValue)) }
        if let statuses, !statuses.isEmpty {
            for s in statuses { items.append(("status", s.rawValue)) }
        }
        if let category { items.append(("category", category)) }
        if let search { items.append(("search", search)) }
        if let projectId { items.append(("projectId", projectId)) }
        if let unsorted { items.append(("unsorted", String(unsorted))) }
        if let needsOrganizing { items.append(("needsOrganizing", String(needsOrganizing))) }
        if let archived { items.append(("archived", String(archived))) }
        if let dueDateFrom {
            items.append(("dueDateFrom", ISO8601DateFormatter.withFractionalSeconds.string(from: dueDateFrom)))
        }
        if let dueDateTo {
            items.append(("dueDateTo", ISO8601DateFormatter.withFractionalSeconds.string(from: dueDateTo)))
        }
        if let scheduledDateFrom {
            items.append(("scheduledDateFrom", ISO8601DateFormatter.withFractionalSeconds.string(from: scheduledDateFrom)))
        }
        if let scheduledDateTo {
            items.append(("scheduledDateTo", ISO8601DateFormatter.withFractionalSeconds.string(from: scheduledDateTo)))
        }
        if let sortBy { items.append(("sortBy", sortBy.rawValue)) }
        if let sortOrder { items.append(("sortOrder", sortOrder.rawValue)) }
        if let page { items.append(("page", String(page))) }
        if let limit { items.append(("limit", String(limit))) }
        return items
    }
}
