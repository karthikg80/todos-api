import SwiftUI

struct EnergyIndicator: View {
    let energy: Energy?

    var body: some View {
        if let energy {
            HStack(spacing: 2) {
                Image(systemName: iconName(for: energy))
                    .font(.caption2)
                Text(energy.displayName)
                    .font(.caption2)
            }
            .foregroundStyle(color(for: energy))
        }
    }

    private func iconName(for energy: Energy) -> String {
        switch energy {
        case .low: "battery.25"
        case .medium: "battery.50"
        case .high: "battery.100"
        }
    }

    private func color(for energy: Energy) -> Color {
        switch energy {
        case .low: .green
        case .medium: .yellow
        case .high: .orange
        }
    }
}

struct EnergyPicker: View {
    @Binding var selection: Energy?

    var body: some View {
        Picker("Energy", selection: $selection) {
            Text("Any").tag(Energy?.none)
            ForEach(Energy.allCases) { e in
                Text(e.displayName).tag(Energy?.some(e))
            }
        }
    }
}
