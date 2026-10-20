#!/usr/bin/env python3
"""Build the offline Windows installer and Android APK from the same dist/."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / 'native'
VERSION = json.loads((ROOT / 'package.json').read_text())['version']

def run(command, **kwargs):
    subprocess.run([str(x) for x in command], check=True, **kwargs)

def java_tool(name):
    binary = shutil.which(name)
    if binary:
        return [binary]
    modules = {'javac': 'jdk.compiler/com.sun.tools.javac.Main', 'jar': 'jdk.jartool/sun.tools.jar.Main', 'keytool': 'java.base/sun.security.tools.keytool.Main'}
    return [os.environ.get('JAVA', 'java'), '-m', modules[name]]

def windows(output):
    source = NATIVE / 'windows'
    web = source / 'web'
    if web.exists(): shutil.rmtree(web)
    shutil.copytree(ROOT / 'dist', web)
    go = os.environ.get('JESUITA_GO', 'go')
    run([go, 'test', './...'], cwd=source)
    app = output / 'OJesuitaSouEu.exe'
    environment = dict(os.environ, GOOS='windows', GOARCH='amd64', CGO_ENABLED='0')
    run([go, 'build', '-trimpath', '-ldflags=-s -w -H=windowsgui -X main.version=' + VERSION, '-o', app, '.'], cwd=source, env=environment)
    # The installer and shortcuts use the existing app icon.
    from PIL import Image
    icon = output / 'app.ico'
    Image.open(ROOT / 'dist/assets/icon-512.png').save(icon, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    installer = output / ('O-jesuita-sou-eu-Setup-' + VERSION + '.exe')
    compiler = os.environ.get('JESUITA_MAKENSIS', 'makensis')
    run([compiler, '-V2', '-DVERSION=' + VERSION, '-DOUTPUT=' + str(installer), '-DAPP=' + str(app), '-DICON=' + str(icon), source / 'installer.nsi'], cwd=source)
    return installer

def android(output):
    sdk_value = os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME')
    if not sdk_value: raise RuntimeError('Set ANDROID_SDK_ROOT to an Android SDK with platform 35 and build-tools 35.')
    sdk = Path(sdk_value)
    tools_value = os.environ.get('JESUITA_ANDROID_BUILD_TOOLS')
    tools = Path(tools_value) if tools_value else sdk / 'build-tools/35.0.0'
    platform = sdk / 'platforms/android-35/android.jar'
    build = NATIVE / 'build/android'
    if build.exists(): shutil.rmtree(build)
    (build / 'classes').mkdir(parents=True)
    (build / 'dex').mkdir()
    (build / 'res/mipmap-xxxhdpi').mkdir(parents=True)
    shutil.copyfile(ROOT / 'dist/assets/icon-192.png', build / 'res/mipmap-xxxhdpi/app_icon.png')
    shutil.copytree(ROOT / 'dist', build / 'assets/web')
    aapt = tools / 'aapt2'
    namespace = 'http://schemas.android.com/apk/res/android'
    ET.register_namespace('android', namespace)
    manifest = ET.parse(NATIVE / 'android/AndroidManifest.xml')
    manifest.getroot().set('{' + namespace + '}versionName', VERSION)
    major, minor, patch = map(int, VERSION.split('.')[:3])
    manifest.getroot().set('{' + namespace + '}versionCode', str(major * 1000000 + minor * 1000 + patch))
    manifest.write(build / 'AndroidManifest.xml', encoding='utf-8', xml_declaration=True)
    run([aapt, 'compile', '--dir', build / 'res', '-o', build / 'resources.zip'])
    unsigned = build / 'unsigned.apk'
    run([aapt, 'link', '--manifest', build / 'AndroidManifest.xml', '-I', platform, '-R', build / 'resources.zip', '-A', build / 'assets', '-o', unsigned])
    run(java_tool('javac') + ['-encoding','UTF-8','-source','8','-target','8','-classpath',platform,'-d',build / 'classes',NATIVE / 'android/MainActivity.java'])
    run(java_tool('jar') + ['cf', build / 'classes.jar', '-C', build / 'classes', '.'])
    java = os.environ.get('JAVA', 'java')
    run([java, '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--lib', platform, '--min-api', '23', '--output', build / 'dex', build / 'classes.jar'])
    with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build / 'dex/classes.dex','classes.dex')
    aligned = build / 'aligned.apk'
    run([tools / 'zipalign','-f','4',unsigned,aligned])
    keystore_value = os.environ.get('JESUITA_ANDROID_KEYSTORE')
    if not keystore_value or not os.environ.get('JESUITA_ANDROID_SIGNING_PASSWORD'):
        raise RuntimeError('Set JESUITA_ANDROID_KEYSTORE and JESUITA_ANDROID_SIGNING_PASSWORD; keep the signing key outside Git.')
    keystore = Path(keystore_value)
    if not keystore.exists():
        keystore.parent.mkdir(parents=True, exist_ok=True)
        run(java_tool('keytool') + ['-genkeypair','-storetype','PKCS12','-keystore',keystore,'-alias','jesuita','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=O jesuita sou eu','-storepass:env','JESUITA_ANDROID_SIGNING_PASSWORD','-keypass:env','JESUITA_ANDROID_SIGNING_PASSWORD'])
        keystore.chmod(0o600)
    target = output / ('O-jesuita-sou-eu-Android-' + VERSION + '.apk')
    run([java,'-jar',tools / 'lib/apksigner.jar','sign','--ks',keystore,'--ks-key-alias','jesuita','--ks-pass','env:JESUITA_ANDROID_SIGNING_PASSWORD','--out',target,aligned])
    run([java,'-jar',tools / 'lib/apksigner.jar','verify','--verbose',target])
    return target

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform',choices=['windows','android','all'],default='all')
    parser.add_argument('--output',type=Path,default=NATIVE / 'output')
    options = parser.parse_args()
    output = options.output.resolve(); output.mkdir(parents=True,exist_ok=True)
    tasks = [windows,android] if options.platform == 'all' else [windows if options.platform == 'windows' else android]
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        for package in pool.map(lambda task:task(output), tasks): print('INSTALLER',package,flush=True)

if __name__ == '__main__': main()
