import type {
  AppInfo,
  AxElement,
  ComputerControl,
  ControlResult,
  ElementSelector,
  Screenshot,
  WindowInfo,
} from "./contract.js";

/**
 * SIMULATION computer-control adapter (R-CLASS-02). Operates on an in-memory
 * virtual desktop so the full control pipeline — inspection, semantic action,
 * policy gating, audit, verification — is exercised end-to-end in the container
 * and in CI. Provenance is permanently "SIMULATION"; nothing here touches a real
 * machine, and results are structurally labeled so the UI never confuses them
 * with live control.
 *
 * The virtual desktop is a real, mutable model: activating an app changes the
 * frontmost flag; pressing a button runs its effect; typing/setValue mutates
 * fields; the clipboard persists. Verification (did the value actually change?)
 * observes the same model, exactly as the real adapter observes AX state.
 */

interface SimApp {
  pid: number;
  name: string;
  bundleId: string;
  windows: SimWindow[];
}
interface SimWindow {
  id: number;
  title: string;
  root: SimElement;
}
interface SimElement {
  path: string;
  role: string;
  title: string | null;
  value: string | null;
  identifier: string | null;
  enabled: boolean;
  focused: boolean;
  frame: { x: number; y: number; w: number; h: number };
  actions: string[];
  children: SimElement[];
  /** effect run on AXPress — mutates the desktop */
  onPress?: (desk: SimulatedDesktop) => void;
}

export class SimulatedDesktop implements ComputerControl {
  readonly provenance = "SIMULATION" as const;

  private apps: SimApp[];
  private frontmostPid: number;
  private clipboard: string | null = null;
  private focusedPath: { windowId: number; path: string } | null = null;

  constructor() {
    // A small but realistic virtual desktop: a Notes-like app and a Settings-like app.
    const notesField: SimElement = {
      path: "window/textArea[0]",
      role: "AXTextArea",
      title: "Note body",
      value: "",
      identifier: "note-body",
      enabled: true,
      focused: true,
      frame: { x: 20, y: 60, w: 600, h: 400 },
      actions: ["AXConfirm"],
      children: [],
    };
    const saveBtn: SimElement = {
      path: "window/button[0]",
      role: "AXButton",
      title: "Save",
      value: null,
      identifier: "save",
      enabled: true,
      focused: false,
      frame: { x: 540, y: 20, w: 80, h: 28 },
      actions: ["AXPress"],
      children: [],
      onPress: (desk) => desk._markSaved(),
    };
    this.apps = [
      {
        pid: 1001,
        name: "Notes",
        bundleId: "com.sim.notes",
        windows: [
          {
            id: 1,
            title: "Untitled Note",
            root: {
              path: "window",
              role: "AXWindow",
              title: "Untitled Note",
              value: null,
              identifier: null,
              enabled: true,
              focused: true,
              frame: { x: 0, y: 0, w: 640, h: 480 },
              actions: [],
              children: [saveBtn, notesField],
            },
          },
        ],
      },
      {
        pid: 1002,
        name: "Settings",
        bundleId: "com.sim.settings",
        windows: [
          {
            id: 2,
            title: "Settings",
            root: {
              path: "window",
              role: "AXWindow",
              title: "Settings",
              value: null,
              identifier: null,
              enabled: true,
              focused: false,
              frame: { x: 100, y: 100, w: 500, h: 400 },
              actions: [],
              children: [
                {
                  path: "window/checkbox[0]",
                  role: "AXCheckBox",
                  title: "Dark Mode",
                  value: "0",
                  identifier: "dark-mode",
                  enabled: true,
                  focused: false,
                  frame: { x: 120, y: 140, w: 200, h: 24 },
                  actions: ["AXPress"],
                  children: [],
                  onPress: (desk) => desk._toggleCheckbox(2, "window/checkbox[0]"),
                },
              ],
            },
          },
        ],
      },
    ];
    this.frontmostPid = 1001;
    this.focusedPath = { windowId: 1, path: "window/textArea[0]" };
  }

  private saved = false;
  _markSaved(): void {
    this.saved = true;
  }
  get wasSaved(): boolean {
    return this.saved;
  }
  _toggleCheckbox(windowId: number, path: string): void {
    const el = this.findByPath(windowId, path);
    if (el) el.value = el.value === "1" ? "0" : "1";
  }

  async listApps(): Promise<AppInfo[]> {
    return this.apps.map((a) => ({
      pid: a.pid,
      name: a.name,
      bundleId: a.bundleId,
      frontmost: a.pid === this.frontmostPid,
    }));
  }

  async listWindows(): Promise<WindowInfo[]> {
    const out: WindowInfo[] = [];
    for (const a of this.apps) {
      for (const w of a.windows) {
        out.push({
          id: w.id,
          appPid: a.pid,
          title: w.title,
          frame: w.root.frame,
          focused: a.pid === this.frontmostPid,
        });
      }
    }
    return out;
  }

  async uiTree(windowId?: number): Promise<AxElement> {
    const win = this.resolveWindow(windowId);
    return this.toAx(win.root);
  }

  async screenshot(windowId?: number): Promise<Screenshot> {
    const win = this.resolveWindow(windowId);
    // A SIMULATION screenshot is a 1x1 labeled placeholder — never a fake render
    // presented as a real screen capture. The AX tree is the real inspection API.
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    return {
      provenance: "SIMULATION",
      width: win.root.frame.w,
      height: win.root.frame.h,
      pngBase64: png,
      capturedAt: this.now(),
    };
  }

  async readClipboard(): Promise<{ provenance: "SIMULATION"; text: string | null }> {
    return { provenance: "SIMULATION", text: this.clipboard };
  }

  async activateApp(pid: number): Promise<ControlResult> {
    const app = this.apps.find((a) => a.pid === pid);
    if (!app) return this.fail(`no app with pid ${pid}`);
    this.frontmostPid = pid;
    return this.ok(`activated ${app.name}`, false);
  }

  async performAction(selector: ElementSelector, action: string): Promise<ControlResult> {
    const { el, usedCoords } = this.select(selector);
    if (!el) return this.fail(`element not found: ${JSON.stringify(selector)}`);
    if (!el.actions.includes(action)) return this.fail(`${el.role} has no action ${action}`);
    if (action === "AXPress" && el.onPress) el.onPress(this);
    return this.ok(`performed ${action} on ${el.role} '${el.title ?? el.identifier}'`, usedCoords);
  }

  async setValue(selector: ElementSelector, value: string): Promise<ControlResult> {
    const { el, usedCoords } = this.select(selector);
    if (!el) return this.fail(`element not found`);
    el.value = value;
    return this.ok(`set ${el.role} value`, usedCoords);
  }

  async typeText(text: string): Promise<ControlResult> {
    if (!this.focusedPath) return this.fail("no focused element to type into");
    const el = this.findByPath(this.focusedPath.windowId, this.focusedPath.path);
    if (!el) return this.fail("focused element missing");
    el.value = (el.value ?? "") + text;
    return this.ok(`typed ${text.length} chars`, false);
  }

  async writeClipboard(text: string): Promise<ControlResult> {
    this.clipboard = text;
    return this.ok(`wrote ${text.length} chars to clipboard`, false);
  }

  // --- helpers ---

  private resolveWindow(windowId?: number): SimWindow {
    if (windowId !== undefined) {
      for (const a of this.apps) {
        const w = a.windows.find((x) => x.id === windowId);
        if (w) return w;
      }
      throw new Error(`no window ${windowId}`);
    }
    const front = this.apps.find((a) => a.pid === this.frontmostPid)!;
    return front.windows[0]!;
  }

  private select(selector: ElementSelector): { el: SimElement | null; usedCoords: boolean } {
    const win = selector.windowId !== undefined ? this.resolveWindow(selector.windowId) : this.resolveWindow();
    const all = this.flatten(win.root);
    if (selector.path) return { el: all.find((e) => e.path === selector.path) ?? null, usedCoords: false };
    if (selector.identifier)
      return { el: all.find((e) => e.identifier === selector.identifier) ?? null, usedCoords: false };
    if (selector.title || selector.role)
      return {
        el:
          all.find(
            (e) =>
              (!selector.title || e.title === selector.title) &&
              (!selector.role || e.role === selector.role),
          ) ?? null,
        usedCoords: false,
      };
    if (selector.point) {
      const p = selector.point;
      return {
        el:
          all.find(
            (e) =>
              p.x >= e.frame.x &&
              p.x <= e.frame.x + e.frame.w &&
              p.y >= e.frame.y &&
              p.y <= e.frame.y + e.frame.h &&
              e.actions.length > 0,
          ) ?? null,
        usedCoords: true,
      };
    }
    return { el: null, usedCoords: false };
  }

  private findByPath(windowId: number, path: string): SimElement | null {
    const win = this.resolveWindow(windowId);
    return this.flatten(win.root).find((e) => e.path === path) ?? null;
  }

  private flatten(el: SimElement): SimElement[] {
    return [el, ...el.children.flatMap((c) => this.flatten(c))];
  }

  private toAx(el: SimElement): AxElement {
    return {
      path: el.path,
      role: el.role,
      title: el.title,
      value: el.value,
      identifier: el.identifier,
      enabled: el.enabled,
      focused: el.focused,
      frame: el.frame,
      actions: el.actions,
      children: el.children.map((c) => this.toAx(c)),
    };
  }

  // Deterministic timestamp source (Date is unavailable in some runtimes; tests
  // override via the injected clock if needed).
  private counter = 0;
  private now(): string {
    return `sim-t${this.counter++}`;
  }

  private ok(summary: string, usedCoordinates: boolean): ControlResult {
    return { ok: true, provenance: "SIMULATION", summary, usedCoordinates };
  }
  private fail(summary: string): ControlResult {
    return { ok: false, provenance: "SIMULATION", summary, usedCoordinates: false };
  }
}
