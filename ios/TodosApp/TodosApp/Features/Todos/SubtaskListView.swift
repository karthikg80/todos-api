import SwiftUI

struct SubtaskListView: View {
    let todoId: String
    @Binding var subtasks: [SubtaskDTO]
    let todoService: any TodoServicing

    @State private var newSubtaskTitle = ""

    var body: some View {
        Section("Subtasks") {
            ForEach(subtasks) { subtask in
                HStack {
                    Button {
                        Task { await toggleSubtask(subtask) }
                    } label: {
                        Image(systemName: subtask.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(subtask.completed ? .green : .secondary)
                    }
                    .buttonStyle(.plain)

                    Text(subtask.title)
                        .strikethrough(subtask.completed)
                        .foregroundStyle(subtask.completed ? .secondary : .primary)

                    Spacer()
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        Task { await deleteSubtask(subtask) }
                    } label: { Label("Delete", systemImage: "trash") }
                }
            }

            HStack {
                TextField("Add subtask", text: $newSubtaskTitle)
                    .textFieldStyle(.roundedBorder)
                Button {
                    Task { await addSubtask() }
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
                .disabled(newSubtaskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func addSubtask() async {
        let title = newSubtaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        do {
            let created = try await todoService.createSubtask(todoId: todoId, CreateSubtaskRequest(title: title))
            subtasks.append(created)
            newSubtaskTitle = ""
        } catch {
            // Silently fail — user can retry
        }
    }

    private func toggleSubtask(_ subtask: SubtaskDTO) async {
        do {
            let updated = try await todoService.updateSubtask(
                todoId: todoId, subtaskId: subtask.id,
                UpdateSubtaskRequest(completed: !subtask.completed)
            )
            if let i = subtasks.firstIndex(where: { $0.id == subtask.id }) {
                subtasks[i] = updated
            }
        } catch {}
    }

    private func deleteSubtask(_ subtask: SubtaskDTO) async {
        do {
            try await todoService.deleteSubtask(todoId: todoId, subtaskId: subtask.id)
            subtasks.removeAll { $0.id == subtask.id }
        } catch {}
    }
}
