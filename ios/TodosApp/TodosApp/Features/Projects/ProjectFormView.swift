import SwiftUI

struct ProjectFormView: View {
    @Environment(\.dismiss) private var dismiss

    let onSave: (CreateProjectRequest) async throws -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var status: ProjectStatus = .active
    @State private var priority: Priority?
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Project Name", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section {
                    Picker("Status", selection: $status) {
                        ForEach(ProjectStatus.allCases) { s in
                            Text(s.displayName).tag(s)
                        }
                    }
                    PriorityPicker(selection: $priority)
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle("New Project")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                }
            }
        }
    }

    private func save() {
        isSubmitting = true
        let dto = CreateProjectRequest(
            name: name.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            status: status,
            priority: priority
        )
        Task {
            do { try await onSave(dto); dismiss() }
            catch let e as AppError { errorMessage = e.userMessage }
            catch { errorMessage = "Failed to create project." }
            isSubmitting = false
        }
    }
}
