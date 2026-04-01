import SwiftUI

struct LoginView: View {
    @Environment(\.appEnvironment) private var env
    @State private var viewModel: AuthViewModel?

    var body: some View {
        NavigationStack {
            if let viewModel {
                if viewModel.isShowingRegister {
                    RegisterView(viewModel: viewModel)
                } else {
                    loginContent(viewModel: viewModel)
                }
            } else {
                ProgressView()
                    .onAppear {
                        guard let env else { return }
                        viewModel = AuthViewModel(authService: env.authService, appState: env.appState)
                    }
            }
        }
    }

    @ViewBuilder
    private func loginContent(viewModel: AuthViewModel) -> some View {
        VStack(spacing: 24) {
            Spacer()
            VStack(spacing: 8) {
                Text("Welcome Back").font(.largeTitle.bold())
                Text("Sign in to your account").foregroundStyle(.secondary)
            }

            VStack(spacing: 16) {
                fieldWithError("Email", text: Binding(get: { viewModel.email }, set: { viewModel.email = $0 }),
                               error: viewModel.fieldErrors["email"], isEmail: true)
                fieldWithError("Password", text: Binding(get: { viewModel.password }, set: { viewModel.password = $0 }),
                               error: viewModel.fieldErrors["password"], isSecure: true)

                if let error = viewModel.generalError {
                    Text(error).font(.callout).foregroundStyle(.red).multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal)

            Button {
                Task { await viewModel.login() }
            } label: {
                if viewModel.isSubmitting { ProgressView().frame(maxWidth: .infinity) }
                else { Text("Sign In").frame(maxWidth: .infinity) }
            }
            .buttonStyle(.borderedProminent).controlSize(.large).disabled(viewModel.isSubmitting)
            .padding(.horizontal)

            Button("Don't have an account? Sign Up") { viewModel.isShowingRegister = true }
                .font(.callout)
            Spacer()
        }
        .padding()
    }

    @ViewBuilder
    private func fieldWithError(_ placeholder: String, text: Binding<String>, error: String?,
                                isEmail: Bool = false, isSecure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if isSecure {
                SecureField(placeholder, text: text)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
            } else {
                TextField(placeholder, text: text)
                    .textContentType(isEmail ? .emailAddress : .name)
                    #if os(iOS)
                    .keyboardType(isEmail ? .emailAddress : .default)
                    .autocapitalization(.none)
                    #endif
                    .textFieldStyle(.roundedBorder)
            }
            if let error {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
    }
}
