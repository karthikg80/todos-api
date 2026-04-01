import SwiftUI

struct ContentView: View {
    @Environment(\.appEnvironment) private var env

    var body: some View {
        Group {
            switch env?.appState.authStatus ?? .launching {
            case .launching, .restoringSession:
                splashView
            case .unauthenticated:
                LoginView()
            case .authenticated:
                mainTabView
            }
        }
        .animation(.easeInOut(duration: 0.3), value: env?.appState.authStatus)
    }

    private var splashView: some View {
        VStack(spacing: 16) {
            ProgressView().controlSize(.large)
            Text("Loading...").foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var mainTabView: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max") }
            TodoListView(initialFilter: TodoListQuery(statuses: [.inbox]))
                .tabItem { Label("Inbox", systemImage: "tray") }
            ProjectListView()
                .tabItem { Label("Projects", systemImage: "folder") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
    }
}
