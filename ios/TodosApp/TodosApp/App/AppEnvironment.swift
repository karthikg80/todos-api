import Foundation
import Observation
import SwiftUI

@Observable
final class AppEnvironment {
    let appState: AppState
    let authService: any AuthServicing
    let todoService: any TodoServicing
    let projectService: any ProjectServicing
    let userService: any UserServicing

    init(
        appState: AppState,
        authService: any AuthServicing,
        todoService: any TodoServicing,
        projectService: any ProjectServicing,
        userService: any UserServicing
    ) {
        self.appState = appState
        self.authService = authService
        self.todoService = todoService
        self.projectService = projectService
        self.userService = userService
    }
}

private struct AppEnvironmentKey: EnvironmentKey {
    static let defaultValue: AppEnvironment? = nil
}

extension EnvironmentValues {
    var appEnvironment: AppEnvironment? {
        get { self[AppEnvironmentKey.self] }
        set { self[AppEnvironmentKey.self] = newValue }
    }
}
