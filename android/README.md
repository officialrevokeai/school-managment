# School Management Android APK

This is a native Android client for the existing server-backed school app. It uses Android's WebView to keep the same frontend, secure server sessions, permissions, live data events and simplified responsive layouts. It does not package Node/PostgreSQL or fictional school records on each phone.

## Install and share

Install `School_Management_Android.apk` on Android 8.0 or newer. Version 3.0.1 opens `https://school-management-system.bot-keep.xyz` automatically on a fresh installation. Sign in with your school credentials. The app menu can change the school server if needed. The address must be the root origin, without login paths, tokens or query strings. Other people can install the same APK and use the same hosted server. The app menu and initial connection screen have **Share this APK**, which opens Android's share chooser with read-only access to the installer file only.

The Node API is now hosted on Botkeep with the private Supabase database. Phones require Internet access; the school database and authentication remain on the server. No private credentials are embedded in the APK.

School roles and hidden master entry remain enforced by the web server. Shared APKs contain no administrator login or automatic access. Every fresh installation opens the live school sign-in page. Sharing the APK grants no school or master access.

## Implemented client behavior

- HTTPS-only, normal certificate verification, no mixed content, no local file/content URL access, no native JavaScript bridge, safe browsing and no WebView debugging.
- Same-origin app navigation; external HTTPS links open the system browser only after a user chooses to do so. No website can silently replace the configured school origin.
- Native insets/back behavior, phone/tablet-friendly server setup, connectivity/certificate error screens, retry and change-server controls.
- Server cookies are private to the app's WebView; change-server clears local cookies/storage. Normal school Sign out revokes the server session through the existing app. No master credentials are saved by native code.
- File uploads use Android's document picker and existing backend validation. Camera/microphone permissions are denied; the app requests only Internet access.
- CSV, report-card and document downloads use a native save dialog, HTTPS/cookie-authenticated same-origin GETs, no redirects and a 25 MB cap. The deployed frontend must include this snapshot's `SchoolManagementAndroid/` export handling to avoid unsupported blob downloads. Files are confirmed saved only after the transfer finishes; failures are reported. Existing browser exports retain their original path.
- Cloud/device-transfer backup of private app storage is disabled. The school database remains on the server. Native APK updates must retain the same signing key and increase the version code. The web frontend updates when the hosted server is updated; this is not background push notification support.

## Build and signing

Run `python android/build_apk.py` from the repository root with Java in `JAVA_HOME`, Android SDK Platform 36 and Build Tools 36.0.0 installed. The script also accepts `--sdk`, `--java-home` and `--output`. It uses official `aapt2`, `javac`, `d8`, `zipalign` and `apksigner` tools with no downloaded libraries. No Gradle installation is necessary for this project. The manifest is package `com.schoolmanagement.mobile`, versionName `3.0.1`, versionCode `2`, minSdk `26`, targetSdk `36`.

The release signing key and password file are kept locally in ignored `runtime/android-signing/`. Back up that directory privately; losing it prevents compatible updates to this installed APK. Do not publish it or put it in the source ZIP. Passwords are passed through child-process environment variables, not command-line arguments. The builder reuses an existing key and refuses mismatched/missing signing files.

Public signing-certificate SHA-256: `7dfaef91bd012ed721df4b5cc18d0da85a951fcee18bdea528993c7d6cc64abb`.

## Verification and remaining acceptance

The 3.0.1 APK was compiled, DEX-built, ZIP-checked, 16 KB page-aligned and verified with APK Signature Schemes v2 and v3 using the official installed SDK. JVM URL/download policy tests passed **35 checks**. Compilation and **16 focused admission/performance/Android tests** passed, plus 210 prototype assertions. The preceding full regression passed 113 tests. Browser responsive checks covered 320px, 390px and 768px admission dialogs with no horizontal document overflow.

No physical phone/emulator installation was performed. Android file-picker/share behavior and all workflows on a real device remain pending. Genuine WhatsApp, payment and other external-provider acceptance is separate. See PERFORMANCE_AND_MOBILE.md for the current checklist.

Official references: [WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [AAPT2](https://developer.android.com/tools/aapt2), [d8](https://developer.android.com/tools/d8), [APK signing/verification](https://developer.android.com/tools/apksigner), [window insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge).
