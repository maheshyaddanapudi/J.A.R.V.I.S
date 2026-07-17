// J.A.R.V.I.S. REAL macOS computer-control adapter (R-CTRL-01/02).
//
// macOS-only (ApplicationServices + AppKit). Implements the SAME operations as
// the SIMULATION adapter in the kernel (services/kernel/src/control/) — app &
// window discovery, AX UI-tree inspection, and semantic AX actions — so the
// policy/approval/audit pipeline verified in-container is unchanged here.
//
// SEMANTIC-FIRST: actions target AX elements by role/title/identifier and use
// AXUIElementPerformAction. CGEvent coordinate synthesis is the last resort and
// is reported as such so the audit shows a coordinate fallback.
//
// Requires the Accessibility TCC grant (System Settings › Privacy & Security ›
// Accessibility). Verified current on macOS 26 (RESEARCH_VERIFICATION §9).
//
// GATE: this adapter is the REAL backend. Per docs/06, wiring it live requires
// the "before enabling computer control" check-in. Until then the kernel uses
// the SIMULATION adapter; this compiles on the Mac and is activated only after
// that check-in.

#if os(macOS)
import AppKit
import ApplicationServices
import Foundation

struct AppInfoDTO: Codable {
    let pid: Int32
    let name: String
    let bundleId: String
    let frontmost: Bool
}

struct AxElementDTO: Codable {
    let path: String
    let role: String
    let title: String?
    let value: String?
    let identifier: String?
    let enabled: Bool
    let focused: Bool
    let frame: [Double]  // x,y,w,h
    let actions: [String]
    let children: [AxElementDTO]
}

struct ControlResultDTO: Codable {
    let ok: Bool
    let provenance: String  // always "REAL" here
    let summary: String
    let usedCoordinates: Bool
}

enum MacDesktop {
    static func ensureTrusted() -> Bool {
        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
        return AXIsProcessTrustedWithOptions(opts as CFDictionary)
    }

    static func listApps() -> [AppInfoDTO] {
        NSWorkspace.shared.runningApplications
            .filter { $0.activationPolicy == .regular }
            .map {
                AppInfoDTO(
                    pid: $0.processIdentifier,
                    name: $0.localizedName ?? "",
                    bundleId: $0.bundleIdentifier ?? "",
                    frontmost: $0.isActive
                )
            }
    }

    /// AX tree for the frontmost window of an app (by pid).
    static func uiTree(pid: pid_t, maxDepth: Int = 12) -> AxElementDTO? {
        let appEl = AXUIElementCreateApplication(pid)
        guard let window = copyAttr(appEl, kAXFocusedWindowAttribute) ?? firstWindow(appEl) else {
            return nil
        }
        return walk(window as! AXUIElement, path: "window", depth: 0, maxDepth: maxDepth)
    }

    static func performAction(pid: pid_t, selector: Selector, action: String) -> ControlResultDTO {
        let appEl = AXUIElementCreateApplication(pid)
        guard let window = copyAttr(appEl, kAXFocusedWindowAttribute) ?? firstWindow(appEl) else {
            return ControlResultDTO(ok: false, provenance: "REAL", summary: "no window", usedCoordinates: false)
        }
        if let el = find(window as! AXUIElement, selector: selector) {
            let err = AXUIElementPerformAction(el, action as CFString)
            return ControlResultDTO(ok: err == .success, provenance: "REAL",
                                    summary: "AXPerform \(action) → \(err.rawValue)",
                                    usedCoordinates: false)
        }
        // Coordinate fallback (last resort) — flagged.
        if let p = selector.point {
            clickAt(x: p.0, y: p.1)
            return ControlResultDTO(ok: true, provenance: "REAL",
                                    summary: "coordinate click (\(p.0),\(p.1))", usedCoordinates: true)
        }
        return ControlResultDTO(ok: false, provenance: "REAL", summary: "element not found", usedCoordinates: false)
    }

    static func setValue(pid: pid_t, selector: Selector, value: String) -> ControlResultDTO {
        let appEl = AXUIElementCreateApplication(pid)
        guard let window = copyAttr(appEl, kAXFocusedWindowAttribute) ?? firstWindow(appEl),
              let el = find(window as! AXUIElement, selector: selector) else {
            return ControlResultDTO(ok: false, provenance: "REAL", summary: "element not found", usedCoordinates: false)
        }
        let err = AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, value as CFString)
        return ControlResultDTO(ok: err == .success, provenance: "REAL",
                                summary: "set value → \(err.rawValue)", usedCoordinates: false)
    }

    // --- AX helpers ---

    struct Selector {
        var role: String?
        var title: String?
        var identifier: String?
        var point: (Double, Double)?
    }

    private static func copyAttr(_ el: AXUIElement, _ attr: String) -> CFTypeRef? {
        var v: CFTypeRef?
        return AXUIElementCopyAttributeValue(el, attr as CFString, &v) == .success ? v : nil
    }

    private static func firstWindow(_ appEl: AXUIElement) -> CFTypeRef? {
        guard let wins = copyAttr(appEl, kAXWindowsAttribute) as? [AXUIElement], let w = wins.first else {
            return nil
        }
        return w
    }

    private static func stringAttr(_ el: AXUIElement, _ attr: String) -> String? {
        copyAttr(el, attr) as? String
    }

    private static func actions(_ el: AXUIElement) -> [String] {
        var names: CFArray?
        guard AXUIElementCopyActionNames(el, &names) == .success, let arr = names as? [String] else {
            return []
        }
        return arr
    }

    private static func walk(_ el: AXUIElement, path: String, depth: Int, maxDepth: Int) -> AxElementDTO {
        let role = stringAttr(el, kAXRoleAttribute) ?? "AXUnknown"
        var kids: [AxElementDTO] = []
        if depth < maxDepth, let children = copyAttr(el, kAXChildrenAttribute) as? [AXUIElement] {
            for (i, c) in children.enumerated() {
                let crole = stringAttr(c, kAXRoleAttribute) ?? "AXUnknown"
                kids.append(walk(c, path: "\(path)/\(crole)[\(i)]", depth: depth + 1, maxDepth: maxDepth))
            }
        }
        var frame = [0.0, 0.0, 0.0, 0.0]
        if let posV = copyAttr(el, kAXPositionAttribute), let sizeV = copyAttr(el, kAXSizeAttribute) {
            var p = CGPoint.zero, s = CGSize.zero
            AXValueGetValue(posV as! AXValue, .cgPoint, &p)
            AXValueGetValue(sizeV as! AXValue, .cgSize, &s)
            frame = [p.x, p.y, s.width, s.height]
        }
        return AxElementDTO(
            path: path, role: role,
            title: stringAttr(el, kAXTitleAttribute),
            value: stringAttr(el, kAXValueAttribute),
            identifier: stringAttr(el, kAXIdentifierAttribute),
            enabled: (copyAttr(el, kAXEnabledAttribute) as? Bool) ?? true,
            focused: (copyAttr(el, kAXFocusedAttribute) as? Bool) ?? false,
            frame: frame, actions: actions(el), children: kids
        )
    }

    private static func find(_ root: AXUIElement, selector: Selector) -> AXUIElement? {
        func match(_ el: AXUIElement) -> Bool {
            if let id = selector.identifier, stringAttr(el, kAXIdentifierAttribute) == id { return true }
            if selector.identifier != nil { return false }
            if let t = selector.title, stringAttr(el, kAXTitleAttribute) != t { return false }
            if let r = selector.role, stringAttr(el, kAXRoleAttribute) != r { return false }
            return selector.title != nil || selector.role != nil
        }
        if match(root) { return root }
        if let children = copyAttr(root, kAXChildrenAttribute) as? [AXUIElement] {
            for c in children { if let hit = find(c, selector: selector) { return hit } }
        }
        return nil
    }

    private static func clickAt(x: Double, y: Double) {
        let pt = CGPoint(x: x, y: y)
        let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left)
        let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pt, mouseButton: .left)
        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
    }
}
#endif
