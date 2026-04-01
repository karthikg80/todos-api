// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodosApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    targets: [
        .executableTarget(
            name: "TodosApp",
            path: "TodosApp",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .testTarget(
            name: "TodosAppTests",
            dependencies: ["TodosApp"],
            path: "TodosAppTests",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
