# Floyd Desktop - Packaging Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-18  
**Platforms:** macOS 26+ (ARM64/x64), Windows 10/11 (x64)

---

## Quick Start

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Package for current platform
npm run package

# Package for specific platforms
npm run package:mac     # macOS DMG + ZIP
npm run package:win     # Windows NSIS + Portable
npm run package:linux   # Linux AppImage
npm run package:all     # All platforms
```

---

## Build Artifacts

### macOS

| Artifact | Location | Size | Description |
|----------|----------|------|-------------|
| `Floyd Desktop-1.0.0-arm64.dmg` | `release/` | ~122 MB | Apple Silicon (M1/M2/M3) installer |
| `Floyd Desktop-1.0.0.dmg` | `release/` | ~130 MB | Intel x64 installer |
| `Floyd Desktop-1.0.0-arm64-mac.zip` | `release/` | ~117 MB | Apple Silicon archive |
| `Floyd Desktop-1.0.0-mac.zip` | `release/` | ~124 MB | Intel archive |

### Windows

| Artifact | Location | Size | Description |
|----------|----------|------|-------------|
| `Floyd Desktop Setup 1.0.0.exe` | `release/` | TBD | NSIS installer |
| `Floyd Desktop 1.0.0.exe` | `release/` | TBD | Portable executable |

---

## Requirements

### Development

- **Node.js:** v25.6.1+
- **npm:** 11.9.0+
- **macOS:** Xcode Command Line Tools (for native modules)

### Building

- **Python 3** (for node-gyp, if building native modules)
- **Git** (for version info)

---

## Project Structure

```
FloydDesktopWeb-v2/
├── electron/
│   ├── main.js           # Electron main process
│   └── preload.js        # IPC bridge (context isolation)
├── build/
│   ├── icon.icns         # macOS icon
│   ├── icon.ico          # Windows icon (auto-generated)
│   ├── icons/            # Linux icons
│   └── entitlements.mac.plist
├── dist/                 # Frontend build output (Vite)
├── dist-server/          # Backend build output (esbuild)
├── release/              # Packaged installers (gitignored)
└── package.json          # Build configuration
```

---

## Configuration Files

### electron-builder.yml

Contains packaging configuration:
- App ID: `com.floyd.desktop`
- Product Name: `Floyd Desktop`
- Output Directory: `release/`

### package.json - Build Section

```json
"build": {
  "appId": "com.floyd.desktop",
  "productName": "Floyd Desktop",
  "directories": {
    "buildResources": "build",
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-server/**/*",
    "electron/**/*",
    "package.json"
  ]
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Build mode | `production` |
| `FLOYD_DESKTOP_MODE` | Desktop mode flag | `electron` |

---

## Code Signing

### macOS

Current status: **Signed with local developer certificate**

For distribution:
1. Get Apple Developer certificate
2. Update `electron-builder.yml` with:
   ```yaml
   mac:
     identity: "Developer ID Application: Your Name (TEAM_ID)"
   ```
3. Enable notarization:
   ```yaml
   afterSign: "scripts/notarize.js"
   ```

### Windows

Status: **Unsigned**

For distribution:
1. Get code signing certificate
2. Update `electron-builder.yml`:
   ```yaml
   win:
     certificateFile: "path/to/cert.pfx"
     certificatePassword: "${WINDOWS_CERT_PASSWORD}"
   ```

---

## Troubleshooting

### Build Issues

**TypeScript compilation errors:**
```bash
# Server uses esbuild (skip type checking for packaging)
npm run build:server
```

**Missing dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Electron download timeout:**
```bash
# Set mirror for China
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

### Runtime Issues

**App won't start:**
1. Check Console.app for crash logs
2. Verify server start: look for `[Server]` logs
3. Check port 3001 availability

**Blank window:**
1. Ensure `dist/` folder exists and has `index.html`
2. Check `electron/main.js` load path

**Server not starting:**
1. Check `dist-server/index.js` exists
2. Verify Node.js version compatibility
3. Check for missing runtime dependencies

---

## Release Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Test on target platforms
- [ ] Code sign (if distributing)
- [ ] Notarize (macOS App Store)
- [ ] Upload artifacts to release
- [ ] Update `latest-mac.yml` / `latest.yml`

---

## CI/CD

GitHub Actions workflows:
- `.github/workflows/safe-ops-*.yml` - Pre-merge validation

For automated releases, see `.github/workflows/release.yml` (to be created).

---

## Support

For issues:
1. Check Console.app (macOS) or Event Viewer (Windows)
2. Run with `--enable-logging` flag
3. Check `~/.floyd-data/logs/` for runtime logs

