import Cocoa
import WebKit

// Использование: snap URL out.png width height "js-скрипт" задержка_сек
let args = CommandLine.arguments
let url = URL(string: args[1])!
let out = args[2]
let w = CGFloat(Double(args[3]) ?? 390), h = CGFloat(Double(args[4]) ?? 844)
let script = args.count > 5 ? args[5] : ""
let delay = args.count > 6 ? (Double(args[6]) ?? 2.0) : 2.0
let post = args.count > 7 ? args[7] : ""

class Snapper: NSObject, WKNavigationDelegate {
  let web: WKWebView
  let win: NSWindow
  init(frame: NSRect) {
    let cfg = WKWebViewConfiguration()
    cfg.websiteDataStore = .nonPersistent()
    web = WKWebView(frame: frame, configuration: cfg)
    win = NSWindow(contentRect: NSRect(x: -20000, y: -20000, width: frame.width, height: frame.height), styleMask: [.borderless], backing: .buffered, defer: false)
    super.init()
    win.contentView = web
    win.orderBack(nil)
    web.navigationDelegate = self
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
      webView.evaluateJavaScript(script.isEmpty ? "1" : script) { res, err in
        if let err = err { print("JS error: \(err)") }
        if let r = res { print("JS result: \(r)") }
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
          webView.evaluateJavaScript(post.isEmpty ? "''" : post) { pr, perr in
          if let perr = perr { print("POST error: \(perr)") }
          if let p = pr as? String, !p.isEmpty { print(p) }
          webView.evaluateJavaScript("(document.querySelector('.fatal')||{}).textContent || ''") { r, _ in
            if let s = r as? String, !s.isEmpty { print("PAGE ERROR: \(s)") }
            let conf = WKSnapshotConfiguration()
            webView.takeSnapshot(with: conf) { img, err in
              guard let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                    let png = rep.representation(using: .png, properties: [:]) else { print("snapshot failed \(String(describing: err))"); exit(1) }
              try? png.write(to: URL(fileURLWithPath: out))
              print("saved \(out)")
              exit(0)
            }
          }
          }
        }
      }
    }
  }
}
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let s = Snapper(frame: NSRect(x: 0, y: 0, width: w, height: h))
s.web.load(URLRequest(url: url))
DispatchQueue.main.asyncAfter(deadline: .now() + 110) { print("timeout"); exit(2) }
app.run()
