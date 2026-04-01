import Foundation
import Observation

@MainActor
@Observable
final class SettingsViewModel {
    var user: UserDTO?
    var baseURLOverride: String
    var isLoggingOut = false

    private let userService: any UserServicing
    private let authService: any AuthServicing
    private let appState: AppState

    init(userService: any UserServicing, authService: any AuthServicing, appState: AppState) {
        self.userService = userService
        self.authService = authService
        self.appState = appState
        self.user = appState.currentUser
        self.baseURLOverride = UserDefaults.standard.string(forKey: "baseURLOverride") ?? ""
    }

    func logout() async {
        isLoggingOut = true
        try? await authService.logout()
        appState.authStatus = .unauthenticated
        isLoggingOut = false
    }

    func saveBaseURL() {
        let trimmed = baseURLOverride.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            UserDefaults.standard.removeObject(forKey: "baseURLOverride")
        } else {
            UserDefaults.standard.set(trimmed, forKey: "baseURLOverride")
        }
    }
}
