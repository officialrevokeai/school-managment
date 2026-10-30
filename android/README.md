# School Management Android APK

This is a native Android client for the existing server-backed school app. It uses Android's WebView to keep the same frontend, secure server sessions, permissions, live data events and simplified responsive layouts. It does not package Node/PostgreSQL or fictional school records on each phone.

## Install and share

Install `School_Management_Android.apk` on Android 8.0 or newer. On first launch, enter the official HTTPS origin of the hosted school app, such as `https://school.example.com`, then use your school credentials. The address must be the root origin, without login paths, tokens or query strings. Other people can install the same APK and use the same hosted server. The app menu and initial connection screen have **Share this APK**, which opens Android's share chooser with read-only access to the installer file only.

The current school server is only running at `127.0.0.1` on the development computer. That address cannot work on other phones. **A reachable HTTPS deployment is still required.** No hosting was purchased or exposed and no private database/credentials were embedded. Supabase alone is not the Node API deployment. See the existing deployment and release gates before public use.

School roles and hidden master entry remain enforced by the web server. Shared APKs contain no administrator login or automatic access. Every fresh installation begins at the server-connection screen; the school UI then opens its sign-in page.

## Implemented client behavior

- HTTPS-only, normal certificate verification, no mixed content, no local file/content URL access, no native JavaScript bridge, safe browsing and no WebView debugging.
- Same-origin app navigation; external HTTPS links open the system browser only after a user chooses to do so. No website can silently replace the configured school origin.
- Native insets/back behavior, phone/tablet-friendly server setup, connectivity/certificate error screens, retry and change-server controls.
- Server cookies are private to the app's WebView; change-server clears local cookies/storage. Normal school Sign out revokes the server session through the existing app. No master credentials are saved by native code.
- File uploads use Android's document picker and existing backend validation. Camera/microphone permissions are denied; the app requests only Internet access.
- CSV, report-card and document downloads use a native save dialog, HTTPS/cookie-authenticated same-origin GETs, no redirects and a 25 MB cap. The deployed frontend must include this snapshot's `SchoolManagementAndroid/` export handling to avoid unsupported blob downloads. Files are confirmed saved only after the transfer finishes; failures are reported. Existing browser exports retain their original path.
- Cloud/device-transfer backup of private app storage is disabled. The school database remains on the server. Native APK updates must retain the same signing key and increase the version code. The web frontend updates when the hosted server is updated; this is not background push notification support.

## Build and signing

Run `python android/build_apk.py` from the repository root with Java in `JAVA_HOME`, Android SDK Platform 36 and Build Tools 36.0.0 installed. The script also accepts `--sdk`, `--java-home` and `--output`. It uses official `aapt2`, `javac`, `d8`, `zipalign` and `apksigner` tools with no downloaded libraries. No Gradle installation is necessary for this project. The manifest is package `com.schoolmanagement.mobile`, versionName `3.0.0`, versionCode `1`, minSdk `26`, targetSdk `36`.

The release signing key and password file are kept locally in ignored `runtime/android-signing/`. Back up that directory privately; losing it prevents compatible updates to this installed APK. Do not publish it or put it in the source ZIP. Passwords are passed through child-process environment variables, not command-line arguments. The builder reuses an existing key and refuses mismatched/missing signing files.

Public signing-certificate SHA-256: `7dfaef91bd012ed721df4b5cc18d0da85a951fcee18bdea528993c7d6cc64abb`.

## Verification and remaining acceptance

The APK was compiled, DEX-built, ZIP-checked, 16 KB page-aligned and verified with APK Signature Schemes v2 and v3 using the official installed SDK. JVM URL/download policy tests passed **34 checks**. TypeScript compilation and **11 focused backend/export tests** passed, including unchanged tenant/role isolation and the authenticated Android download path. The earlier full application suite passed 91 backend tests and 210 prototype checks.

No real phone/emulator installation or live hosted-school session was exercised. Device file-picker/share behavior, all workflows on Android, payment checkout and real provider acceptance still need testing against the hosted HTTPS server. A signed installer is not evidence of real WhatsApp delivery, payment acceptance or production deployment.

Official references: [WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [AAPT2](https://developer.android.com/tools/aapt2), [d8](https://developer.android.com/tools/d8), [APK signing/verification](https://developer.android.com/tools/apksigner), [window insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge).
