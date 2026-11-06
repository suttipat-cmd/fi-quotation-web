#!/bin/sh
set -eu
signing_dir="$HOME/Library/Application Support/FI Quotation/android-signing"
if [ ! -r "$signing_dir/release-key.jks" ] || [ ! -r "$signing_dir/password.txt" ]; then
  echo 'ไม่พบกุญแจหรือรหัสผ่านสำหรับลงนาม release' >&2
  exit 1
fi
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_TOOL_OPTIONS='-Duser.language=en -Duser.country=US'
export FI_ANDROID_KEYSTORE="$signing_dir/release-key.jks"
export FI_ANDROID_KEY_ALIAS='fi-quotation-release'
export FI_ANDROID_STORE_PASSWORD="$(cat "$signing_dir/password.txt")"
export FI_ANDROID_KEY_PASSWORD="$FI_ANDROID_STORE_PASSWORD"
npm run build:android
./android/gradlew -p android assembleRelease
