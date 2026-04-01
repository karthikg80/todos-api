import SwiftUI

struct FilterBar: View {
    @Binding var selectedStatus: TaskStatus?
    @Binding var selectedPriority: Priority?

    private let statuses: [TaskStatus] = [.inbox, .next, .inProgress, .waiting, .scheduled, .someday]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(label: "All", isSelected: selectedStatus == nil) {
                    selectedStatus = nil
                }
                ForEach(statuses) { status in
                    FilterChip(label: status.displayName, isSelected: selectedStatus == status) {
                        selectedStatus = (selectedStatus == status) ? nil : status
                    }
                }

                Divider().frame(height: 20)

                Menu {
                    Button("Any Priority") { selectedPriority = nil }
                    ForEach(Priority.allCases) { p in
                        Button(p.displayName) { selectedPriority = p }
                    }
                } label: {
                    FilterChip(
                        label: selectedPriority?.displayName ?? "Priority",
                        isSelected: selectedPriority != nil
                    ) {}
                }
            }
            .padding(.horizontal)
        }
    }
}

private struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.15))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
