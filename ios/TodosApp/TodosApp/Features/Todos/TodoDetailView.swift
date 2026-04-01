import SwiftUI

struct TodoDetailView: View {
    @Environment(\.dismiss) private var dismiss

    @State var todo: TodoDTO
    let todoService: any TodoServicing
    var onDismiss: (() -> Void)?

    @State private var isEditing = false
    @State private var subtasks: [SubtaskDTO]

    init(todo: TodoDTO, todoService: any TodoServicing, onDismiss: (() -> Void)? = nil) {
        self._todo = State(initialValue: todo)
        self.todoService = todoService
        self.onDismiss = onDismiss
        self._subtasks = State(initialValue: todo.subtasks ?? [])
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(todo.title).font(.headline)
                    if let desc = todo.description, !desc.isEmpty {
                        Text(desc).foregroundStyle(.secondary)
                    }
                }

                Section("Status") {
                    LabeledContent("Status") {
                        Label(todo.status.displayName, systemImage: todo.status.iconName)
                    }
                    if let priority = todo.priority {
                        LabeledContent("Priority") { PriorityBadge(priority: priority) }
                    }
                    if let energy = todo.energy {
                        LabeledContent("Energy") { EnergyIndicator(energy: energy) }
                    }
                }

                if todo.dueDate != nil || todo.startDate != nil || todo.scheduledDate != nil {
                    Section("Dates") {
                        if let d = todo.dueDate { LabeledContent("Due", value: d.formatted(date: .abbreviated, time: .omitted)) }
                        if let d = todo.startDate { LabeledContent("Start", value: d.formatted(date: .abbreviated, time: .omitted)) }
                        if let d = todo.scheduledDate { LabeledContent("Scheduled", value: d.formatted(date: .abbreviated, time: .omitted)) }
                    }
                }

                if let est = todo.estimateMinutes {
                    Section("Details") {
                        LabeledContent("Estimate", value: "\(est) min")
                    }
                }

                if let notes = todo.notes, !notes.isEmpty {
                    Section("Notes") { Text(notes) }
                }

                SubtaskListView(todoId: todo.id, subtasks: $subtasks, todoService: todoService)
            }
            .navigationTitle("Task Details")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        onDismiss?()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") { isEditing = true }
                }
            }
            .sheet(isPresented: $isEditing) {
                TodoFormView(mode: .edit(todo)) { dto in
                    let updated = try await todoService.update(todo.id, UpdateTodoRequest(
                        title: dto.title,
                        description: dto.description,
                        status: dto.status,
                        dueDate: dto.dueDate,
                        priority: dto.priority,
                        energy: dto.energy,
                        estimateMinutes: dto.estimateMinutes,
                        notes: dto.notes
                    ))
                    todo = updated
                }
            }
        }
    }
}
