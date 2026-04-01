import SwiftUI

struct RegisterView: View {
    @Bindable var viewModel: AuthViewModel

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            VStack(spacing: 8) {
                Text("Create Account").font(.largeTitle.bold())
                Text("Sign up to get started").foregroundStyle(.secondary)
            }

            VStack(spacing: 16) {
                field("Name", text: $viewModel.name, error: viewModel.fieldErrors["name"])
                field("Email", text: $viewModel.email, error: viewModel.fieldErrors["email"], isEmail: true)
                secureField("Password", text: $viewModel.password, error: viewModel.fieldErrors["password"])

                if let error = viewModel.generalError {
                    Text(error).font(.callout).foregroundStyle(.red).multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal)

            Button {
                Task { await viewModel.register() }
            } label: {
                if viewModel.isSubmitting { ProgressView().frame(maxWidth: .infinity) }
                else { Text("Create Account").frame(maxWidth: .infinity) }
            }
            .buttonStyle(.borderedProminent).controlSize(.large).disabled(viewModel.isSubmitting)
            .padding(.horizontal)

            Button("Already have an account? Sign In") { viewModel.isShowingRegister = false }
                .font(.callout)
            Spacer()
        }
        .padding()
    }

    @ViewBuilder
    private func field(_ placeholder: String, text: Binding<String>, error: String?, isEmail: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(placeholder, text: text)
                .textContentType(isEmail ? .emailAddress : .name)
                #if os(iOS)
                .keyboardType(isEmail ? .emailAddress : .default)
                .autocapitalization(.none)
                #endif
                .textFieldStyle(.roundedBorder)
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }
    }

    @ViewBuilder
    private func secureField(_ placeholder: String, text: Binding<String>, error: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SecureField(placeholder, text: text)
                .textContentType(.newPassword).textFieldStyle(.roundedBorder)
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
        }
    }
}
