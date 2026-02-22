#!/bin/bash
# Fix FLOYD CURSE'M app if it gets quarantined again

APP_PATH="/Applications/FLOYD CURSE'M.app"

echo "Fixing FLOYD CURSE'M app..."

# Remove quarantine attributes
xattr -cr "$APP_PATH"

# Re-sign with ad-hoc signature
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null

echo "✓ Fixed. You can now open the app."
echo ""
echo "If macOS still prompts, right-click the app and select 'Open', then click 'Open' in the dialog."
