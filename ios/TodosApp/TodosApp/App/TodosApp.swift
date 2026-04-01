import SwiftUI

@main
struct TodosApp: App {
    private let environment: AppEnvironment

    init() {
        let appState = AppState()
        let tokenStorage = TokenStorage()

        let baseURL: URL = {
            if let override = UserDefaults.standard.string(forKey: "baseURLOverride"),
               let url = URL(string: override) {
                return url
            }
            if let urlString = Bundle.main.infoDictionary?["BASE_URL"] as? String,
               let url = URL(string: urlString) {
                return url
            }
            return URL(string: "http://localhost:3000")!
        }()

        #if DEBUG
        print("[TodosApp] baseURL: \(baseURL.absoluteString)")
        #endif

        let sessionCoordinator = SessionCoordinator(
            tokenStorage: tokenStorage,
            baseURL: baseURL,
            onSessionInvalidated: { @MainActor in
                appState.authStatus = .unauthenticated
            }
        )

        let apiClient = APIClient(
            baseURL: baseURL,
            tokenStorage: tokenStorage,
            sessionCoordinator: sessionCoordinator
        )

        self.environment = AppEnvironment(
            appState: appState,
            authService: AuthService(apiClient: apiClient, tokenStorage: tokenStorage),
            todoService: TodoService(apiClient: apiClient),
            projectService: ProjectService(apiClient: apiClient),
            userService: UserService(apiClient: apiClient)
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.appEnvironment, environment)
                .task { await restoreSession() }
        }
    }

    private func restoreSession() async {
        let appState = environment.appState
        appState.authStatus = .restoringSession
        do {
            let user = try await environment.authService.restoreSession()
            appState.authStatus = .authenticated(user)
        } catch {
            appState.authStatus = .unauthenticated
        }
    }
}
