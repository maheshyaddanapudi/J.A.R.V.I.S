// J.A.R.V.I.S. macOS audio bridge — REAL echo-cancelled acoustic path.
//
// macOS-only (AVFoundation). This is the piece that cannot run in the Linux dev
// container: it opens the real microphone and speakers and enables the Voice
// Processing I/O audio unit (Apple's AEC/NS/AGC — the same FaceTime uses) so the
// barge-in VAD hears the USER, not J.A.R.V.I.S.'s own voice out of the speakers.
//
// It captures 16 kHz mono float32 frames and streams them to jarvis-ears; it
// plays TTS PCM back through the same voice-processed output node. The whole
// speech pipeline (wake/VAD/STT/TTS/turn-taking) already runs and is verified in
// the ears service; this supplies the device I/O + echo cancellation.
//
// Build/run on the Mac:  swift run JarvisAudio --ears ws://127.0.0.1:4170/listen

import AVFoundation
import Foundation

/// Enables Voice Processing I/O (echo cancellation) on an AVAudioEngine and
/// bridges mic capture + speaker playback at a fixed 16 kHz mono float32 format.
final class AudioBridge {
    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let targetFormat: AVAudioFormat
    private var onFrame: (([Float]) -> Void)?

    init(sampleRate: Double = 16_000) {
        targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        )!
    }

    /// Start capture. `onFrame` receives mono float32 samples (echo-cancelled).
    func start(onFrame: @escaping ([Float]) -> Void) throws {
        self.onFrame = onFrame

        let input = engine.inputNode
        // Enabling voice processing on the input node auto-enables it on the
        // output node too: this is what gives us AEC/NS/AGC. Must be set before
        // the engine starts and before taps are installed.
        try input.setVoiceProcessingEnabled(true)
        try engine.outputNode.setVoiceProcessingEnabled(true)

        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: nil)

        let inputFormat = input.outputFormat(forBus: 0)
        guard let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw NSError(domain: "JarvisAudio", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "cannot build audio converter"])
        }

        input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
            guard let self = self else { return }
            let ratio = self.targetFormat.sampleRate / inputFormat.sampleRate
            let outCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16
            guard let out = AVAudioPCMBuffer(pcmFormat: self.targetFormat,
                                             frameCapacity: outCapacity) else { return }
            var consumed = false
            var err: NSError?
            converter.convert(to: out, error: &err) { _, status in
                if consumed { status.pointee = .noDataNow; return nil }
                consumed = true
                status.pointee = .haveData
                return buffer
            }
            if err != nil { return }
            if let ch = out.floatChannelData {
                let n = Int(out.frameLength)
                self.onFrame?(Array(UnsafeBufferPointer(start: ch[0], count: n)))
            }
        }

        engine.prepare()
        try engine.start()
    }

    /// Play TTS PCM (float32) at its own sample rate through the voice-processed
    /// output. `stop()` interrupts immediately for barge-in / emergency stop.
    func play(pcm: [Float], sampleRate: Double) {
        guard let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                      sampleRate: sampleRate, channels: 1, interleaved: false),
              let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(pcm.count))
        else { return }
        buf.frameLength = AVAudioFrameCount(pcm.count)
        pcm.withUnsafeBufferPointer { src in
            buf.floatChannelData![0].update(from: src.baseAddress!, count: pcm.count)
        }
        if !playerNode.isPlaying { playerNode.play() }
        playerNode.scheduleBuffer(buf, completionHandler: nil)
    }

    func stopPlayback() {
        playerNode.stop()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }
}
