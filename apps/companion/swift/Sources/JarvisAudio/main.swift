// JarvisAudio entry point — streams echo-cancelled mic frames to jarvis-ears
// /listen (WebSocket) and plays back TTS the service returns. macOS-only.
//
// Usage: swift run JarvisAudio [--ears ws://127.0.0.1:4170/listen]
//
// Requires the microphone TCC grant (macOS prompts on first run). The frame
// protocol matches jarvis-ears exactly: raw little-endian float32 mono @16 kHz.

import AVFoundation
import Foundation

let earsURL: URL = {
    if let i = CommandLine.arguments.firstIndex(of: "--ears"),
       i + 1 < CommandLine.arguments.count,
       let u = URL(string: CommandLine.arguments[i + 1]) {
        return u
    }
    return URL(string: "ws://127.0.0.1:4170/listen")!
}()

final class EarsClient: NSObject, URLSessionWebSocketDelegate {
    private var task: URLSessionWebSocketTask?
    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    func connect() {
        task = session.webSocketTask(with: earsURL)
        task?.resume()
        receive()
    }

    func sendFrame(_ samples: [Float]) {
        var data = Data(capacity: samples.count * 4)
        for s in samples { withUnsafeBytes(of: s.bitPattern.littleEndian) { data.append(contentsOf: $0) } }
        task?.send(.data(data)) { err in if let err = err { FileHandle.standardError.write("send: \(err)\n".data(using: .utf8)!) } }
    }

    private func receive() {
        task?.receive { [weak self] result in
            switch result {
            case .failure(let err):
                FileHandle.standardError.write("ws closed: \(err)\n".data(using: .utf8)!)
            case .success(let msg):
                if case .string(let text) = msg { print("ears » \(text)") }
                self?.receive()
            }
        }
    }
}

let client = EarsClient()
client.connect()

let bridge = AudioBridge(sampleRate: 16_000)
do {
    try bridge.start { samples in client.sendFrame(samples) }
    print("JarvisAudio: echo-cancelled capture running → \(earsURL)")
    print("Speak the wake word 'hey jarvis'. Ctrl-C to stop.")
} catch {
    FileHandle.standardError.write("failed to start audio: \(error)\n".data(using: .utf8)!)
    exit(1)
}

signal(SIGINT) { _ in exit(0) }
RunLoop.main.run()
