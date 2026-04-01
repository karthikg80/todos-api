import SwiftUI

enum TodoFormMode {
    case create
    case edit(TodoDTO)
}

struct TodoFormView: View {
    @Environment(\.dismiss) private var dismiss

    let mode: TodoFormMode
    let onSave: (CreateTodoRequest) async throws -> Void

    @State private var title = ""
    @State private var description = ""
    @State private var status: TaskStatus = .inbox
    @State private var priority: Priority?
    @State private var energy: Energy?
    @State private var dueDate: Date?
    @State private var hasDueDate = false
    @State private var notes = ""
    @State private var estimateMinutes: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var showAdvanced = false

    init(mode: TodoFormMode, onSave: @escaping (CreateTodoRequest) async throws -> Void) {
        self.mode = mode
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }

                Section {
                    StatusPicker(selection: $status)
                    PriorityPicker(selection: $priority)
                    EnergyPicker(selection: $energy)
                }

                Section {
                    Toggle("Due Date", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("Due", selection: Binding(
                            get: { dueDate ?? Date() },
                            set: { dueDate = $0 }
                        ), displayedComponents: .date)
                    }
                }

                DisclosureGroup("Advanced", isExpanded: $showAdvanced) {
                    TextField("Estimate (minutes)", text: $estimateMinutes)
                        #if os(iOS)
                        .keyboardType(.numberPad)
                        #endif
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Task" : "New Task")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") { save() }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                }
            }
            .onAppear { populateFromEdit() }
        }
    }

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private func populateFromEdit() {
        if case .edit(let todo) = mode {
            title = todo.title
            description = todo.description ?? ""
            status = todo.status
            priority = todo.priority
            energy = todo.energy
            if let d = todo.dueDate { dueDate = d; hasDueDate = true }
            notes = todo.notes ?? ""
            if let est = todo.estimateMinutes { estimateMinutes = String(est) }
        }
    }

    private func save() {
        isSubmitting = true
        errorMessage = nil
        let dto = CreateTodoRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            status: status,
            dueDate: hasDueDate ? (dueDate ?? Date()) : nil,
            priority: priority,
            energy: energy,
            estimateMinutes: Int(estimateMinutes),
            notes: notes.isEmpty ? nil : notes
        )
        Task {
            do {
                try await onSave(dto)
                dismiss()
            } catch let error as AppError {
                errorMessage = error.userMessage
            } catch {
                errorMessage = "Failed to save task."
            }
            isSubmitting = false
        }
    }
}
