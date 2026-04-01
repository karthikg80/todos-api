import Foundation
import Observation

@MainActor
@Observable
final class AuthViewModel {
    var email = ""
    var password = ""
    var name = ""
    var fieldErrors: [String: String] = [:]
    var generalError: String?
    var isSubmitting = false
    var isShowingRegister = false

    private let authService: any AuthServicing
    private let appState: AppState

    init(authService: any AuthServicing, appState: AppState) {
        self.authService = authService
        self.appState = appState
    }

    func login() async {
        clearErrors()
        guard validate(requireName: false) else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let user = try await authService.login(email: email, password: password)
            appState.authStatus = .authenticated(user)
        } catch let error as AppError {
            if case .serverError(401, _) = error {
                generalError = "Invalid email or password."
            } else {
                generalError = error.userMessage
            }
        } catch {
            generalError = "An unexpected error occurred."
        }
    }

    func register() async {
        clearErrors()
        guard validate(requireName: true) else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let user = try await authService.register(email: email, password: password, name: name.isEmpty ? nil : name)
            appState.authStatus = .authenticated(user)
        } catch let error as AppError {
            generalError = error.userMessage
        } catch {
            generalError = "An unexpected error occurred."
        }
    }

    private func validate(requireName: Bool) -> Bool {
        var valid = true
        if email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            fieldErrors["email"] = "Email is required."
            valid = false
        }
        if password.count < 6 {
            fieldErrors["password"] = "Password must be at least 6 characters."
            valid = false
        }
        if requireName && name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            fieldErrors["name"] = "Name is required."
            valid = false
        }
        return valid
    }

    private func clearErrors() {
        fieldErrors = [:]
        generalError = nil
    }
}
