import SwiftUI

struct SettingsView: View {
    @Environment(\.appEnvironment) private var env
    @State private var viewModel: SettingsViewModel?

    var body: some View {
        NavigationStack {
            Group {
                if let viewModel {
                    settingsContent(viewModel: viewModel)
                } else {
                    ProgressView().onAppear {
                        guard let env else { return }
                        viewModel = SettingsViewModel(
                            userService: env.userService,
                            authService: env.authService,
                            appState: env.appState
                        )
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }

    @ViewBuilder
    private func settingsContent(viewModel: SettingsViewModel) -> some View {
        Form {
            if let user = viewModel.user {
                Section("Account") {
                    LabeledContent("Email", value: user.email)
                    if let name = user.name { LabeledContent("Name", value: name) }
                }
            }

            #if DEBUG
            Section("Developer") {
                TextField("API Base URL Override", text: Binding(
                    get: { viewModel.baseURLOverride },
                    set: { viewModel.baseURLOverride = $0 }
                ))
                #if os(iOS)
                .keyboardType(.URL)
                .autocapitalization(.none)
                #endif
                .textFieldStyle(.roundedBorder)
                .onSubmit { viewModel.saveBaseURL() }

                Text("Leave empty to use default. Restart app after changing.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            #endif

            Section("About") {
                LabeledContent("Version") {
                    Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }
            }

            Section {
                Button(role: .destructive) {
                    Task { await viewModel.logout() }
                } label: {
                    if viewModel.isLoggingOut {
                        ProgressView()
                    } else {
                        Text("Log Out")
                    }
                }
                .disabled(viewModel.isLoggingOut)
            }
        }
    }
}
