"""Build/sign without downloading dependencies, using official installed SDK tools.
Run from the project root: python android/build_apk.py
The private signing key is retained in ignored runtime/android-signing.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / 'android'
parser = argparse.ArgumentParser()
parser.add_argument('--sdk', default=os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME') or str(Path(os.environ.get('LOCALAPPDATA', '')) / 'Android' / 'Sdk'))
parser.add_argument('--java-home', default=os.environ.get('JAVA_HOME', ''))
parser.add_argument('--output', default=str(ROOT.parent / 'School_Management_Android.apk'))
args = parser.parse_args()
sdk, java_home, output = Path(args.sdk), Path(args.java_home), Path(args.output).resolve()
tools = sdk / 'build-tools' / '36.0.0'
android_jar = sdk / 'platforms' / 'android-36' / 'android.jar'
suffix = '.exe' if os.name == 'nt' else ''
java, javac, jar, keytool = [java_home / 'bin' / (n + suffix) for n in ('java', 'javac', 'jar', 'keytool')]
for path in [java, javac, jar, keytool, android_jar, tools / ('aapt2' + suffix), tools / ('zipalign' + suffix), tools / 'lib' / 'd8.jar', tools / 'lib' / 'apksigner.jar']:
    if not path.is_file(): raise SystemExit('Required Android build tool is missing: ' + str(path))

work = ROOT / 'runtime' / 'android-build'
work.mkdir(parents=True, exist_ok=True)
# Use a new build directory rather than recursively deleting existing paths.
build = work / secrets.token_hex(6)
for name in ['classes', 'dex', 'test-classes']: (build / name).mkdir(parents=True)
env = os.environ.copy()
def run(arguments):
    subprocess.run([str(x) for x in arguments], check=True, cwd=ROOT, env=env, timeout=180)

sources = sorted((ANDROID / 'src').rglob('*.java'))
run([javac, '--release', '8', '-encoding', 'UTF-8', '-classpath', android_jar, '-d', build / 'classes', *sources])
run([javac, '--release', '8', '-encoding', 'UTF-8', '-d', build / 'test-classes', ANDROID / 'src/com/schoolmanagement/mobile/ServerPolicy.java', ANDROID / 'test/ServerPolicyTest.java'])
run([java, '-cp', build / 'test-classes', 'com.schoolmanagement.mobile.ServerPolicyTest'])
run([tools / ('aapt2' + suffix), 'compile', '--dir', ANDROID / 'res', '-o', build / 'resources.zip'])
run([tools / ('aapt2' + suffix), 'link', '-I', android_jar, '--manifest', ANDROID / 'AndroidManifest.xml', '--min-sdk-version', '26', '--target-sdk-version', '36', '-o', build / 'unsigned.apk', build / 'resources.zip'])
run([jar, '--create', '--file', build / 'classes.jar', '-C', build / 'classes', '.'])
run([java, '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', android_jar, '--output', build / 'dex', build / 'classes.jar'])
with zipfile.ZipFile(build / 'unsigned.apk', 'a', compression=zipfile.ZIP_DEFLATED) as apk:
    for dex in sorted((build / 'dex').glob('*.dex')): apk.write(dex, dex.name)
run([tools / ('zipalign' + suffix), '-P', '16', '-f', '4', build / 'unsigned.apk', build / 'aligned.apk'])

signing = ROOT / 'runtime' / 'android-signing'
signing.mkdir(parents=True, exist_ok=True)
key, credentials = signing / 'school-release.p12', signing / 'signing-private.json'
if key.exists() and not credentials.exists(): raise SystemExit('Existing signing key has no local password file; restore its private backup. No key was replaced.')
if not key.exists() and credentials.exists(): raise SystemExit('Signing password exists but key is missing. Restore the original key to preserve APK update compatibility.')
if credentials.exists(): password = json.loads(credentials.read_text(encoding='utf-8'))['password']
else:
    password = secrets.token_urlsafe(40)
    with credentials.open('x', encoding='utf-8') as file: json.dump({'password': password, 'alias': 'school-release'}, file)
    os.chmod(credentials, 0o600)
env['APK_KEYSTORE_PASS'] = password
if not key.exists():
    run([keytool, '-genkeypair', '-noprompt', '-storetype', 'PKCS12', '-keystore', key, '-storepass:env', 'APK_KEYSTORE_PASS', '-keypass:env', 'APK_KEYSTORE_PASS', '-alias', 'school-release', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=School Management, O=School Management'])
output.parent.mkdir(parents=True, exist_ok=True)
run([java, '-jar', tools / 'lib/apksigner.jar', 'sign', '--ks', key, '--ks-key-alias', 'school-release', '--ks-pass', 'env:APK_KEYSTORE_PASS', '--key-pass', 'env:APK_KEYSTORE_PASS', '--v4-signing-enabled', 'false', '--out', output, build / 'aligned.apk'])
run([java, '-jar', tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', output])
run([tools / ('zipalign' + suffix), '-c', '-P', '16', '4', output])
run([tools / ('aapt' + suffix), 'dump', 'badging', output])
with zipfile.ZipFile(output) as apk:
    if apk.testzip() is not None: raise SystemExit('APK ZIP integrity failed')
    if not {'AndroidManifest.xml', 'classes.dex', 'resources.arsc'}.issubset(apk.namelist()): raise SystemExit('APK components are missing')
    if any('signing-private' in n or n.endswith(('.p12','.env','.jks')) for n in apk.namelist()): raise SystemExit('Private build data cannot be packaged')
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.apk.sha256').write_text(digest+'  '+output.name+'\n',encoding='ascii')
(work / 'latest-build.json').write_text(json.dumps({'apk':str(output),'sha256':digest,'bytes':output.stat().st_size,'sdk':36,'minSdk':26,'version':'3.0.0','signatureVerified':True,'liveServerConfigured':False},indent=2),encoding='utf-8')
print('APK built, aligned, signed and verified:', output)
print('Size:', output.stat().st_size, 'bytes. Keep runtime/android-signing private and backed up for future updates.')
