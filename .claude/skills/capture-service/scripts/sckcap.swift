// sckcap — ScreenCaptureKit 캡처러. capture.mjs가 컴파일해서 쓴다.
//   sckcap --bundle-id com.google.chrome.for.testing --rect x,y,w,h(points) --scale 2 --fps 60 --codec h264|prores --out file.mov
//   sckcap ... --still out.png            첫 프레임 한 장만 PNG로 (크롭 보정용)
//   stdin: 'q' → 마무리 · 'm <x> <y> <shape>' → 커서 위치(캡처 사각형 기준 points, shape=arrow|ibeam|pointer)
//   stdout: 첫 프레임에 "READY", 끝에 통계 JSON 한 줄.
//
// 왜 SCK인가: 앱 필터라 다른 창이 앞에 있어도 안 잡히고, OS 커서를 구조적으로 빼고, 60Hz 타이머로 CFR을 보장한다.
// 커서(--cursor on): OS 커서 대신 NSCursor의 진짜 커서 이미지를 우리가 프레임에 그린다. 좌표는 러너가 stdin으로 준다 —
// 페이지 안 오버레이(v2)의 세 결함(내비게이션마다 좌상단으로 튐 · CSS transition 지연 · 모양 고정)이 구조적으로 사라진다.
import Foundation
import AppKit
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreImage
import Metal
import ImageIO
import UniformTypeIdentifiers

var opts: [String: String] = [:]
var it = CommandLine.arguments.dropFirst().makeIterator()
while let a = it.next() { if a.hasPrefix("--") { opts[String(a.dropFirst(2))] = it.next() ?? "" } }
let bundleId = opts["bundle-id"] ?? "com.google.chrome.for.testing"
let pidOpt = opts["pid"].flatMap { Int32($0) }
let rectGiven = opts["rect"] != nil
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
// independent: 창 하나를 위치와 무관하게 잡는다(시뮬레이터). 창에 붙은 팝업(번역 풍선 등)도 같이 합성된다.
// display: 그 창만 포함해 화면 좌표로 잘라낸다. 붙은 팝업이 빠진다 — 브라우저 촬영은 이쪽.
let winMode = opts["window-mode"] ?? "independent"
let cursorOn = (opts["cursor"] ?? "off") == "on"
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

  // ── 커서 합성 ──
  var curX = -1.0, curY = -1.0, curShape = "arrow"
  var pool: CVPixelBufferPool?
  var composed: CVPixelBuffer?          // 마지막 합성 결과 — 소스·커서가 그대로면 재사용한다(복제 틱이 대부분이라 이득이 크다)
  var composedKey: (CVPixelBuffer, Double, Double, String)?
  lazy var ciCtx: CIContext = MTLCreateSystemDefaultDevice().map { CIContext(mtlDevice: $0) } ?? CIContext()
  var cursorCache: [String: (CIImage, CGPoint, CGSize)] = [:]   // 이미지 · hotSpot(points) · 크기(points)

  /// stdin 한 줄: "m <x> <y> <shape>" — 캡처 사각형 왼쪽 위 원점, points
  func setCursor(_ line: String) {
    let f = line.split(separator: " ")
    guard f.count >= 3, let x = Double(f[1]), let y = Double(f[2]) else { return }
    q.async { self.curX = x; self.curY = y; if f.count >= 4 { self.curShape = String(f[3]) } }
  }

  func cursorImage(_ name: String) -> (CIImage, CGPoint, CGSize)? {
    if let c = cursorCache[name] { return c }
    let ns: NSCursor = name == "ibeam" ? .iBeam : name == "pointer" ? .pointingHand : .arrow
    var r = CGRect(x: 0, y: 0, width: ns.image.size.width, height: ns.image.size.height)
    guard let cg = ns.image.cgImage(forProposedRect: &r, context: nil, hints: nil) else { return nil }
    let v = (CIImage(cgImage: cg), ns.hotSpot, ns.image.size)
    cursorCache[name] = v
    return v
  }

  /// 소스 프레임 위에 커서를 그려 새 버퍼를 돌려준다. 그릴 게 없으면 nil (소스를 그대로 쓴다)
  func withCursor(_ src: CVPixelBuffer) -> CVPixelBuffer? {
    guard cursorOn, curX >= 0, let (img, hot, ptSize) = cursorImage(curShape), let pool = pool else { return nil }
    if let k = composedKey, k.0 === src, k.1 == curX, k.2 == curY, k.3 == curShape { return composed }
    var outPB: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &outPB) == kCVReturnSuccess, let dst = outPB else { return nil }

    // NSCursor 이미지는 points 기준이고 cgImage는 그보다 클 수 있다(Retina 표현) — points→픽셀로 다시 맞춘다
    let wantW = ptSize.width * scale
    let k = wantW / img.extent.width
    let cur = img.transformed(by: CGAffineTransform(scaleX: k, y: k))
    // 화면 좌표(왼쪽 위 원점) → CoreImage 좌표(왼쪽 아래 원점)
    let x = (curX - hot.x) * scale
    let yTop = (curY - hot.y) * scale
    let placed = cur.transformed(by: CGAffineTransform(translationX: x, y: Double(outH) - yTop - cur.extent.height))
    ciCtx.render(placed.composited(over: CIImage(cvPixelBuffer: src)), to: dst)
    composed = dst; composedKey = (src, curX, curY, curShape)
    return dst
  }

  func start() async throws {
    let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
    guard let display = content.displays.first else { throw err("디스플레이 없음") }
    let filter: SCContentFilter
    var srcRect = rect
    if let title = windowTitle {
      // 창 모드 — iOS 시뮬레이터처럼 화면이 창 하나에 담긴 경우. sourceRect는 창 기준 좌표(points), --trim-top으로 타이틀바를 뺀다.
      // 창 모드는 창이 뒤에 있어도·다른 Space에 있어도 그 창만 잡는다 — 전체화면도 포커스도 필요 없다.
      let cands = content.windows.filter { w in
        let owner = pidOpt != nil ? (w.owningApplication?.processID == pidOpt!) : (w.owningApplication?.bundleIdentifier == bundleId)
        return owner && (title.isEmpty || (w.title ?? "").contains(title)) && w.frame.width > 100 && w.frame.height > 100
      }.sorted { $0.frame.width * $0.frame.height > $1.frame.width * $1.frame.height }
      guard let win = cands.first
      else { throw err("창 없음: \(pidOpt.map { "pid \($0)" } ?? bundleId)\(title.isEmpty ? "" : " 제목에 '\(title)' 포함")") }
      let f = win.frame
      if winMode == "display" {
        // 그 창만 그린다 — 앞의 다른 창도, 이 창에 붙은 팝업도 안 들어온다. 좌표는 화면 기준.
        filter = SCContentFilter(display: display, including: [win])
        srcRect = CGRect(x: f.origin.x + (rectGiven ? rect.origin.x : 0), y: f.origin.y + trimTop,
                         width: rectGiven ? rect.width : f.width,
                         height: rectGiven ? rect.height : f.height - trimTop)
      } else {
        filter = SCContentFilter(desktopIndependentWindow: win)
        // --rect가 있으면 그 크기를 창 기준으로 쓴다(크롬 높이는 --trim-top). 없으면 타이틀바만 뺀 창 전체.
        srcRect = CGRect(x: rectGiven ? rect.origin.x : 0, y: trimTop,
                         width: rectGiven ? rect.width : f.width,
                         height: rectGiven ? rect.height : f.height - trimTop)
      }
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
    if cursorOn {
      let attrs: [String: Any] = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                                  kCVPixelBufferWidthKey as String: outW, kCVPixelBufferHeightKey as String: outH,
                                  kCVPixelBufferMetalCompatibilityKey as String: true]
      CVPixelBufferPoolCreate(nil, [kCVPixelBufferPoolMinimumBufferCountKey as String: 6] as CFDictionary, attrs as CFDictionary, &pool)
      if pool == nil { log("커서 합성용 버퍼 풀 생성 실패 — 커서 없이 계속") }
    }
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
      guard !stopping, let src = latest, let inp = input, let ad = adaptor else { return }
      guard inp.isReadyForMoreMediaData else { notReady += 1; tick += 1; return }
      let pb = withCursor(src) ?? src
      if ad.append(pb, withPresentationTime: CMTime(value: tick, timescale: fps)) {
        appended += 1
        if lastAppended === src { dupped += 1 }
        lastAppended = src
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
    while let line = readLine() {
      if line.hasPrefix("q") { rec.finish(); return }
      if line.hasPrefix("m ") { rec.setCursor(line) }
    }
    rec.finish()   // stdin EOF도 종료 신호
  }
} else {
  // still 모드는 stdin을 읽지 않는다 (러너가 stdin을 닫은 채로 띄우므로 EOF가 즉시 온다). 첫 프레임이 6초 안에 안 오면 실패.
  DispatchQueue.global().asyncAfter(deadline: .now() + 6) { log("still 타임아웃: 프레임이 오지 않음"); exit(1) }
}
dispatchMain()
