// swift-tools-version:5.9
// J.A.R.V.I.S. macOS audio bridge — builds ONLY on macOS (needs AVFoundation +
// the Voice Processing I/O audio unit). This is the real acoustic path for the
// M3 Max: echo-cancelled mic capture + speaker playback, streaming PCM to the
// jarvis-ears service over WebSocket. Build on the Mac with `swift build`.
import PackageDescription

let package = Package(
    name: "JarvisAudio",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "JarvisAudio",
            path: "Sources/JarvisAudio"
        )
    ]
)
