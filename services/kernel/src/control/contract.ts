/**
 * macOS computer-control hardware-abstraction layer (R-CTRL-01…05).
 *
 * The typed contract every control backend implements. Two backends live behind
 * it (honesty rule R-CORE-02):
 *   - SimulatedDesktop  — a labeled SIMULATION over an in-memory virtual desktop;
 *     runs in the Linux container and in CI, every result carries
 *     provenance = "SIMULATION". Never presented as controlling a real machine.
 *   - MacDesktop        — the real adapter (AXUIElement + CGEvent + ScreenCaptureKit)
 *     in apps/companion/swift/; builds and runs only on macOS.
 *
 * SEMANTIC-FIRST (R-CTRL-02): callers act on stable AX identifiers (role, title,
 * identifier), never raw coordinates unless nothing structured exists — and a
 * coordinate action is flagged as such for audit.
 *
 * Provenance travels with every result so the UI can render a permanent
 * SIMULATION badge and never confuse simulated state with a real machine.
 */

export type ControlProvenance = "REAL" | "SIMULATION";

export interface AppInfo {
  pid: number;
  name: string;
  bundleId: string;
  frontmost: boolean;
}

export interface WindowInfo {
  id: number;
  appPid: number;
  title: string;
  frame: { x: number; y: number; w: number; h: number };
  focused: boolean;
}

/** A node in the accessibility (AX) UI tree. */
export interface AxElement {
  /** stable path from the window root, e.g. "window/group[0]/button[2]" */
  path: string;
  role: string; // AXButton, AXTextField, AXStaticText, AXMenuItem, ...
  title: string | null;
  value: string | null;
  identifier: string | null; // AXIdentifier if the app sets one
  enabled: boolean;
  focused: boolean;
  frame: { x: number; y: number; w: number; h: number };
  actions: string[]; // AXPress, AXConfirm, ... available AX actions
  children: AxElement[];
}

export interface Screenshot {
  provenance: ControlProvenance;
  width: number;
  height: number;
  /** PNG bytes base64; for SIMULATION this is a rendered description image */
  pngBase64: string;
  capturedAt: string;
}

/** How an element was addressed — semantic identifiers preferred over coords. */
export interface ElementSelector {
  windowId?: number;
  path?: string;
  role?: string;
  title?: string;
  identifier?: string;
  /** last-resort absolute point; using this sets `usedCoordinates` in the result */
  point?: { x: number; y: number };
}

export interface ControlResult {
  ok: boolean;
  provenance: ControlProvenance;
  summary: string;
  usedCoordinates: boolean;
  data?: unknown;
}

export interface ComputerControl {
  readonly provenance: ControlProvenance;

  // --- read-only inspection (READ_ONLY risk) ---
  listApps(): Promise<AppInfo[]>;
  listWindows(): Promise<WindowInfo[]>;
  /** AX tree for a window (or the focused window when id omitted). */
  uiTree(windowId?: number): Promise<AxElement>;
  screenshot(windowId?: number): Promise<Screenshot>;
  readClipboard(): Promise<{ provenance: ControlProvenance; text: string | null }>;

  // --- actions (CONSEQUENTIAL unless noted) ---
  activateApp(pid: number): Promise<ControlResult>;
  /** perform an AX action (e.g. AXPress) on a semantically-selected element */
  performAction(selector: ElementSelector, action: string): Promise<ControlResult>;
  /** set an AX text field's value (semantic; not keystroke synthesis) */
  setValue(selector: ElementSelector, value: string): Promise<ControlResult>;
  /** type text into the focused element (keystroke synthesis) */
  typeText(text: string): Promise<ControlResult>;
  writeClipboard(text: string): Promise<ControlResult>;
}
