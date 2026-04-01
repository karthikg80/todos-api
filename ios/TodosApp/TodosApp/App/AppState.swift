import Foundation
import Observation

enum AuthStatus: Equatable {
    case launching
    case restoringSession
    case authenticated(UserDTO)
    case unauthenticated

    static func == (lhs: AuthStatus, rhs: AuthStatus) -> Bool {
        switch (lhs, rhs) {
        case (.launching, .launching), (.restoringSession, .restoringSession), (.unauthenticated, .unauthenticated): true
        case let (.authenticated(a), .authenticated(b)): a.id == b.id
        default: false
        }
    }
}

@MainActor
@Observable
final class AppState {
    var authStatus: AuthStatus = .launching

    var currentUser: UserDTO? {
        if case .authenticated(let user) = authStatus { return user }
        return nil
    }

    var isAuthenticated: Bool {
        if case .authenticated = authStatus { return true }
        return false
    }
}
