// sckcap — ScreenCaptureKit 캡처러. capture.mjs가 컴파일해서 쓴다.
//   sckcap --bundle-id com.google.chrome.for.testing --rect x,y,w,h(points) --scale 2 --fps 60 --codec h264|prores --out file.mov
//   sckcap ... --still out.png            첫 프레임 한 장만 PNG로 (크롭 보정용)
//   stdin에 'q' 또는 SIGINT → 마무리. stdout: 첫 프레임에 "READY", 끝에 통계 JSON 한 줄.
//
// 왜 SCK인가: 앱 필터라 다른 창이 앞에 있어도 안 잡히고, 커서를 명시적으로 끄고, 60Hz 타이머로 CFR을 보장한다.
import Foundation
import AppKit
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreImage
import ImageIO
import UniformTypeIdentifiers

var opts: [String: String] = [:]
var it = CommandLine.arguments.dropFirst().makeIterator()
while let a = it.next() { if a.hasPrefix("--") { opts[String(a.dropFirst(2))] = it.next() ?? "" } }
let bundleId = opts["bundle-id"] ?? "com.google.chrome.for.testing"
let pidOpt = opts["pid"].flatMap { Int32($0) }
let rp = (opts["rect"] ?? "0,0,1600,900").split(separator: ",").compactMap { Double($0) }
let rect = CGRect(x: rp[0], y: rp[1], width: rp[2], height: rp[3])
let scale = Double(opts["scale"] ?? "2") ?? 2
let fps = Int32(opts["fps"] ?? "60") ?? 60
let codec = opts["codec"] ?? "h264"
let bitrate = Int(opts["bitrate"] ?? "40000000") ?? 40_000_000
let outPath = opts["out"] ?? "out.mov"
let stillPath = opts["still"]
let windowTitle = opts["window-title"]                      // 창 모드: 이 문자열을 제목에 포함한 창 하나를 잡는다 (예: "iPhone")
let trimTop = Double(opts["trim-top"] ?? "28") ?? 28        // 창 모드에서 위에서 잘라낼 타이틀바 높이(points)
var outW = Int(rect.width * scale), outH = Int(rect.height * scale)

func log(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }
func emit(_ s: String) { print(s); fflush(stdout) }

final class Recorder: NSObject, SCStreamOutput, SCStreamDelegate {
  var stream: SCStream?
  var writer: AVAssetWriter?
  var input: AVAssetWriterInput?
  var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  var latest: CVPixelBuffer?
  var lastAppended: CVPixelBuffer?
  var timer: DispatchSourceTimer?
  var tick: Int64 = 0
  var received = 0, appended = 0, dupped = 0, notReady = 0
  var stopping = false
  let q = DispatchQueue(label: "sckcap.frames")

  func start() async throws {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
    guard let display = content.displays.first else { throw err("디스플레이 없음") }
    let filter: SCContentFilter
    var srcRect = rect
    if let title = windowTitle {
      // 창 모드 — iOS 시뮬레이터처럼 화면이 창 하나에 담긴 경우. sourceRect는 창 기준 좌표(points), --trim-top으로 타이틀바를 뺀다.
      guard let win = content.windows.first(where: { ($0.owningApplication?.bundleIdentifier == bundleId) && ($0.title ?? "").contains(title) })
      else { throw err("창 없음: \(bundleId) 제목에 '\(title)' 포함") }
      filter = SCContentFilter(desktopIndependentWindow: win)
      let f = win.frame
      srcRect = CGRect(x: 0, y: trimTop, width: f.width, height: f.height - trimTop)
      outW = Int(srcRect.width * scale); outH = Int(srcRect.height * scale)
      log("window '\(win.title ?? "")' frame=\(f) → src=\(srcRect)")
    } else {
      let apps = content.applications.filter { pidOpt != nil ? $0.processID == pidOpt! : $0.bundleIdentifier == bundleId }
      guard !apps.isEmpty else { throw err("캡처할 앱 없음: \(pidOpt.map { "pid \($0)" } ?? bundleId)") }
      filter = SCContentFilter(display: display, including: apps, exceptingWindows: [])
    }
    let cfg = SCStreamConfiguration()
    cfg.width = outW; cfg.height = outH
    cfg.sourceRect = srcRect
    cfg.scalesToFit = false
    cfg.showsCursor = false
    cfg.minimumFrameInterval = CMTime(value: 1, timescale: fps)
    cfg.pixelFormat = kCVPixelFormatType_32BGRA
    cfg.queueDepth = 8
    cfg.capturesAudio = false
    let s = SCStream(filter: filter, configuration: cfg, delegate: self)
    try s.addStreamOutput(self, type: .screen, sampleHandlerQueue: q)
    stream = s
    if stillPath == nil { try setupWriter() }
    try await s.startCapture()
    log("capturing \(windowTitle.map { "window '\($0)'" } ?? "app \(bundleId)") src=\(srcRect) → \(outW)×\(outH) @\(fps)")
  }

  func setupWriter() throws {
    let w = try AVAssetWriter(outputURL: URL(fileURLWithPath: outPath), fileType: .mov)
    let settings: [String: Any] = codec == "prores"
      ? [AVVideoCodecKey: AVVideoCodecType.proRes422, AVVideoWidthKey: outW, AVVideoHeightKey: outH]
      : [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: outW, AVVideoHeightKey: outH,
         AVVideoCompressionPropertiesKey: [
           AVVideoAverageBitRateKey: bitrate,
           AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
           AVVideoMaxKeyFrameIntervalKey: Int(fps),
           AVVideoAllowFrameReorderingKey: false,
           AVVideoExpectedSourceFrameRateKey: Int(fps)]]
    let inp = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    inp.expectsMediaDataInRealTime = true
    let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: inp, sourcePixelBufferAttributes: nil)
    w.add(inp)
    guard w.startWriting() else { throw w.error ?? err("writer 시작 실패") }
    w.startSession(atSourceTime: .zero)
    writer = w; input = inp; adaptor = ad
  }

  func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen, sb.isValid, let pb = CMSampleBufferGetImageBuffer(sb) else { return }
    if let atts = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
       let st = atts.first?[.status] as? Int, st != SCFrameStatus.complete.rawValue { return }
    received += 1
    latest = pb
    if let p = stillPath { writePNG(pb, p); finish(); return }
    if timer == nil { startTimer(); emit("READY") }
  }

  func stream(_ stream: SCStream, didStopWithError error: Error) { log("stream 중단: \(error.localizedDescription)"); finish() }

  // 60Hz 고정 간격으로 마지막 프레임을 쓴다 — SCK는 화면이 안 바뀌면 프레임을 주지 않으므로 이렇게 해야 CFR이다
  func startTimer() {
    let t = DispatchSource.makeTimerSource(queue: q)
    t.schedule(deadline: .now(), repeating: 1.0 / Double(fps), leeway: .milliseconds(1))
    t.setEventHandler { [unowned self] in
      guard !stopping, let pb = latest, let inp = input, let ad = adaptor else { return }
      guard inp.isReadyForMoreMediaData else { notReady += 1; tick += 1; return }
      if ad.append(pb, withPresentationTime: CMTime(value: tick, timescale: fps)) {
        appended += 1
        if lastAppended === pb { dupped += 1 }
        lastAppended = pb
      } else { log("append 실패: \(writer?.error?.localizedDescription ?? "?")") }
      tick += 1
    }
    t.resume(); timer = t
  }

  func finish() {
    if stopping { return }
    stopping = true
    timer?.cancel()
    Task {
      try? await stream?.stopCapture()
      if let inp = input, let w = writer {
        inp.markAsFinished()
        await w.finishWriting()
        if w.status != .completed { log("writer 상태: \(w.status.rawValue) \(w.error?.localizedDescription ?? "")") }
      }
      emit("{\"received\":\(received),\"appended\":\(appended),\"dupped\":\(dupped),\"notReady\":\(notReady),\"ticks\":\(tick),\"fps\":\(fps),\"size\":[\(outW),\(outH)]}")
      exit(0)
    }
  }

  func writePNG(_ pb: CVPixelBuffer, _ path: String) {
    let ci = CIImage(cvPixelBuffer: pb)
    guard let cg = CIContext().createCGImage(ci, from: ci.extent),
          let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil) else { log("PNG 실패"); return }
    CGImageDestinationAddImage(dest, cg, nil); CGImageDestinationFinalize(dest)
  }

  func err(_ m: String) -> NSError { NSError(domain: "sckcap", code: 1, userInfo: [NSLocalizedDescriptionKey: m]) }
}

// 창 필터(desktopIndependentWindow)는 WindowServer 연결이 필요하다 — CLI라 AppKit을 한 번 초기화해 CGS 연결을 만든다
_ = NSApplication.shared
NSApp.setActivationPolicy(.prohibited)
let rec = Recorder()
signal(SIGINT) { _ in rec.finish() }
signal(SIGTERM) { _ in rec.finish() }
Task {
  do { try await rec.start() }
  catch { log("시작 실패: \(error.localizedDescription) — 화면 기록 권한(시스템 설정 → 개인정보 보호)을 터미널에 줬는지 확인"); exit(1) }
}
if stillPath == nil {
  DispatchQueue.global().async {
    while let line = readLine() { if line.hasPrefix("q") { rec.finish(); return } }
    rec.finish()   // stdin EOF도 종료 신호
  }
} else {
  // still 모드는 stdin을 읽지 않는다 (러너가 stdin을 닫은 채로 띄우므로 EOF가 즉시 온다). 첫 프레임이 6초 안에 안 오면 실패.
  DispatchQueue.global().asyncAfter(deadline: .now() + 6) { log("still 타임아웃: 프레임이 오지 않음"); exit(1) }
}
dispatchMain()
