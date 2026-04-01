import SwiftUI

struct PriorityBadge: View {
    let priority: Priority?

    var body: some View {
        if let priority {
            Text(priority.displayName)
                .font(.caption2.bold())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(color(for: priority).opacity(0.15))
                .foregroundStyle(color(for: priority))
                .clipShape(Capsule())
        }
    }

    private func color(for priority: Priority) -> Color {
        switch priority {
        case .low: .secondary
        case .medium: .blue
        case .high: .orange
        case .urgent: .red
        }
    }
}

struct PriorityPicker: View {
    @Binding var selection: Priority?

    var body: some View {
        Picker("Priority", selection: $selection) {
            Text("None").tag(Priority?.none)
            ForEach(Priority.allCases) { p in
                Text(p.displayName).tag(Priority?.some(p))
            }
        }
    }
}
