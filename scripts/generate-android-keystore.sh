#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-web2app-release.jks}"
ALIAS="${2:-web2app}"

echo "Generating keystore: ${OUT}"
keytool -genkeypair -v \
  -keystore "${OUT}" \
  -alias "${ALIAS}" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "${ANDROID_KEYSTORE_PASSWORD:-changeit}" \
  -keypass "${ANDROID_KEY_PASSWORD:-changeit}" \
  -dname "CN=Web2App, OU=Mobile, O=Web2App, L=Local, ST=Local, C=CN"

echo ""
echo "Add these GitHub repository secrets:"
echo "  ANDROID_KEYSTORE_BASE64=$(base64 -w 0 "${OUT}" 2>/dev/null || base64 -i "${OUT}")"
echo "  ANDROID_KEYSTORE_PASSWORD=${ANDROID_KEYSTORE_PASSWORD:-changeit}"
echo "  ANDROID_KEY_PASSWORD=${ANDROID_KEY_PASSWORD:-changeit}"
echo "  ANDROID_KEY_ALIAS=${ALIAS}"
