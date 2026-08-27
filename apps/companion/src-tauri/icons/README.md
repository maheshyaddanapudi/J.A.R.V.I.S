# App icons (generated on the Mac)

Tauri needs `icon.icns` (macOS) + `icon.png` here to bundle the `.app`. They are
**not** committed (binary; generated from the design-system mark at the R-UI-01
check-in). Generate them on the Mac from a 1024×1024 source PNG:

```bash
cd apps/companion
pnpm tauri icon path/to/jarvis-1024.png   # writes icon.icns, icon.png, icon.ico, and the sized PNGs here
```

Until then `cargo tauri build` will prompt for icons. Any placeholder 1024² PNG
works to get a first build; the real mark lands with the design system.
