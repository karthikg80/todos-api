import Foundation

enum AppError: Error, Equatable {
    case network(URLError)
    case unauthorized
    case serverError(statusCode: Int, message: String?)
    case decodingFailed(String)
    case validationFailed([String])

    static func == (lhs: AppError, rhs: AppError) -> Bool {
        switch (lhs, rhs) {
        case (.unauthorized, .unauthorized): true
        case let (.network(a), .network(b)): a.code == b.code
        case let (.serverError(a1, a2), .serverError(b1, b2)): a1 == b1 && a2 == b2
        case let (.decodingFailed(a), .decodingFailed(b)): a == b
        case let (.validationFailed(a), .validationFailed(b)): a == b
        default: false
        }
    }

    var userMessage: String {
        switch self {
        case .network(let error):
            if error.code == .notConnectedToInternet { return "No internet connection." }
            if error.code == .timedOut { return "Request timed out. Please try again." }
            return "A network error occurred. Please try again."
        case .unauthorized:
            return "Your session has expired. Please log in again."
        case .serverError(_, let message):
            return message ?? "Something went wrong. Please try again."
        case .decodingFailed:
            return "Unexpected response from server."
        case .validationFailed(let errors):
            return errors.joined(separator: "\n")
        }
    }
}
