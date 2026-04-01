import SwiftUI

struct StatusPicker: View {
    @Binding var selection: TaskStatus

    var body: some View {
        Picker("Status", selection: $selection) {
            ForEach(TaskStatus.allCases) { status in
                Label(status.displayName, systemImage: status.iconName)
                    .tag(status)
            }
        }
    }
}

struct OptionalStatusPicker: View {
    @Binding var selection: TaskStatus?

    var body: some View {
        Picker("Status", selection: $selection) {
            Text("Any").tag(TaskStatus?.none)
            ForEach(TaskStatus.allCases) { status in
                Label(status.displayName, systemImage: status.iconName)
                    .tag(TaskStatus?.some(status))
            }
        }
    }
}
