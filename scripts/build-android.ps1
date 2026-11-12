$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = "C:\Java\jdk-21" }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "D:\Android\Sdk" }
if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME }
if (-not $env:ANDROID_USER_HOME) { $env:ANDROID_USER_HOME = "D:\Android\.android" }
if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = "D:\Android\gradle" }

if (-not (Test-Path (Join-Path $env:ANDROID_HOME "platform-tools"))) {
    throw "找不到 Android SDK：$env:ANDROID_HOME。请先安装 platform-tools / platforms;android-36 / build-tools;36.0.0。"
}

Write-Host "[build-android] npm run cap:sync" -ForegroundColor Cyan
npm run cap:sync
if ($LASTEXITCODE -ne 0) { throw "cap:sync 失败" }

Write-Host "[build-android] gradlew assembleDebug" -ForegroundColor Cyan
Push-Location (Join-Path $root "android")
try {
    & ".\gradlew.bat" assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Gradle 构建失败" }
}
finally {
    Pop-Location
}

$apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { throw "找不到 APK：$apk" }

$appVersion = (node -p "require('./package.json').version").Trim()
if (-not $appVersion) { throw "读取 package.json 版本失败" }

$dist = Join-Path $root "release"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$output = Join-Path $dist "MONOSABA-Mobile-$appVersion-debug.apk"
Copy-Item $apk $output -Force

Write-Host ""
Write-Host "[build-android] 完成：" -ForegroundColor Green
Write-Host "  $output"
Write-Host "  安装：D:\Android\Sdk\platform-tools\adb.exe install -r `"$output`""
