//! J.A.R.V.I.S. macOS companion — Tauri 2 shell.
//!
//! Hosts the Command Center window and adds the two things a native shell must
//! give the platform: a **persistent emergency stop reachable from anywhere**
//! (the menu-bar tray) and a **global push-to-talk hotkey**. The e-stop and status
//! calls go through the verified `jarvis-companion-core` crate to the REAL local
//! kernel — no mock. Loopback only (R-LOC-01).
//!
//! BUILD: macOS only (needs WKWebView). Compiled with `cargo tauri build` /
//! `pnpm tauri build` on the Mac. The tray/shortcut API below targets Tauri 2;
//! confirm exact signatures against the pinned Tauri version on first build.

use jarvis_companion_core as kernel;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const KERNEL: &str = kernel::DEFAULT_KERNEL;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // ---- Menu-bar tray: persistent EMERGENCY STOP in every interface (R-UI) ----
            let estop = MenuItem::with_id(app, "estop", "⏹  EMERGENCY STOP", true, None::<&str>)?;
            let resume = MenuItem::with_id(app, "resume", "Resume from stop", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open Command Center", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&estop, &resume, &open, &sep, &quit])?;

            let _tray = TrayIconBuilder::with_id("jarvis-tray")
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("J.A.R.V.I.S.")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "estop" => log_result("engage", kernel::engage_estop(KERNEL)),
                    "resume" => log_result("resume", kernel::resume_estop(KERNEL)),
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // ---- Global push-to-talk hotkey (Cmd+Shift+J) ----
            // On press, bring J.A.R.V.I.S. forward. The audio capture itself is the
            // Swift JarvisAudio bridge (VPIO); this hotkey is the always-available
            // "start listening" affordance the platform expects.
            let ptt: Shortcut = "CmdOrCtrl+Shift+J".parse()?;
            let handle = app.handle().clone();
            app.global_shortcut().on_shortcut(ptt, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the J.A.R.V.I.S. companion");
}

fn log_result(op: &str, r: Result<(), kernel::KernelError>) {
    match r {
        Ok(()) => eprintln!("[companion] {op}: ok"),
        Err(e) => eprintln!("[companion] {op} FAILED: {e}"),
    }
}
