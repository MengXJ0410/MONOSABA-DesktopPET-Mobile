# 魔女小屋 / MONOSABA Mobile

希罗 / 艾玛 Live2D 手机应用（Android 初版）。界面、模型和台词沿用桌面版 `MONOSABA-DesktopPET`，但不再做桌面桌宠，只在打开 App 时陪伴。

- 应用名：**魔女小屋**
- 包名：`com.mengxj.monosaba.mobile`
- 版本：`0.1.0`
- 目标平台：Android 8.0+（minSdk 26），锁定竖屏

## 功能

- **全屏 Live2D**：希罗 / 艾玛 4096 WebP 模型，PixiJS 8 + Cubism 5。
- **点击互动**：点人物随机表情 + 气泡台词；艾玛有 75% 概率播放 `kiang.wav`（1 秒冷却）。
- **待机视线**：跟手 / 跟触摸；静止 3 秒后视线漂移，并随机做待机表情。
- **切换人物**：设置里切换，背景、面板、状态栏、图标同步换主题。
- **人物大小**：50%–200% 滑杆，也支持在人物上双指缩放。
- **自动轮换**：默认关闭；开启后在希罗 / 艾玛之间按 5–600 秒的随机区间切换，每次重新随机；设置面板打开或 App 在后台时暂停。
- **自动保存**：当前人物、人物大小、自动轮换设置写入 `localStorage`，重启后恢复。
- **启动页 / 图标**：黑红「魔女小屋」启动图和花形应用图标。
- **返回键**：先关日记 / 设置；在根界面双击返回退出。
- **后台暂停**：切到后台暂停 Live2D 渲染，回前台恢复。

## 与桌面版的差异

为了手机端简洁，以下桌面专属功能**没有出现在 UI 里**，但实现思路保留在 `src/platform/features.ts` 的开关中：

| 桌面功能 | 手机端 |
| --- | --- |
| 鼠标穿透 / 悬停不透明度 | 静默 |
| 强制顶层 | 静默 |
| 开机自启 | 静默 |
| 多屏切换 / 托盘 | 静默 |
| 窗口拖拽 / 位置记忆 | 静默 |
| 显示 / 隐藏人物 | 静默 |
| 拖动人物到屏幕任意位置 | 静默（人物固定在底部居中） |

手机端保留的模块：人物模型、切换人物、人物大小、自动轮换、点击表情 / 气泡 / 音效、待机视线、主题、自动保存。

## 日记 / 记忆

初版只保留入口和接口，不连 SSH、不读服务器、不在手机上保存私钥。

- 希罗的设置里点「偷看日记」会弹出咒语输入框。
- 无论输入什么，提交后都会提示 **「希罗酱不想给你看日记」**。
- 记忆入口不显示（记忆本来就需要先打开日记）。
- 接口定义在 `src/lib/diary/gateway.ts`：

```ts
type DiaryGateway = {
  available(): Promise<boolean>;
  unlock(passphrase: string): Promise<UnlockResult>;
  loadDiary(book?: string | null): Promise<DiaryResult>;
  loadMemory(): Promise<MemoryResult>;
};
```

未来接入时新增一个 HTTP 实现（例如读取 `VITE_DIARY_API_BASE`），返回结构沿用 `DiaryPayload` / `MemoryPayload` 即可，UI 不需要改。手机端不建议直接跑 SSH。

## 目录

```text
src/
├─ components/
│  ├─ companion/        # 全屏舞台、模型、点击、视线、气泡
│  ├─ settings/         # 底部设置抽屉
│  └─ diary/            # 日记咒语占位弹窗
├─ content/live2d.ts    # 人物、台词、表情、缩放/轮换常量
├─ lib/live2d/          # 待机视线、点击音效规则
├─ lib/diary/           # 日记接口占位
├─ platform/
│  ├─ features.ts       # 手机端功能开关（桌面功能静默处）
│  └─ native.ts         # 状态栏、返回键、前后台、震动、竖屏
├─ shared/types.ts      # 日记 / 记忆返回类型
├─ styles/              # 全局样式、希罗/艾玛主题变量
├─ app.tsx
└─ main.tsx
public/
├─ live2d/              # 模型、Cubism Core、图标
└─ voice/kiang.wav
android/                # Capacitor 生成的 Android 工程
assets/                 # 图标 / 启动图源文件
scripts/
├─ make-assets.mjs      # 生成 assets/icon.png、splash.png
└─ build-android.ps1    # 一键同步 + 打 debug APK
```

## 开发

要求：

- Node.js 22+（本机使用 24）
- JDK 21
- Android SDK Platform 36 + Build-Tools 36（仅打 APK 时需要）

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173` 即可调试；页面在桌面浏览器里会按窗口比例自适应。

类型检查与 Web 构建：

```bash
npm run typecheck
npm run build
```

## 构建 Android APK

本机 SDK 默认在 `D:\Android\Sdk`，Gradle 缓存在 `D:\Android\gradle`。首次构建前确认：

```powershell
$env:JAVA_HOME="C:\Java\jdk-21"
$env:ANDROID_HOME="D:\Android\Sdk"
$env:ANDROID_SDK_ROOT="D:\Android\Sdk"
$env:ANDROID_USER_HOME="D:\Android\.android"
$env:GRADLE_USER_HOME="D:\Android\gradle"
```

一键构建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1
```

或者手动：

```bash
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

产物：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`build-android.ps1` 会把它复制到：

```text
release/MONOSABA-Mobile-0.1.0-debug.apk
```

安装到手机：

```powershell
D:\Android\Sdk\platform-tools\adb.exe install -r release\MONOSABA-Mobile-0.1.0-debug.apk
```

首次安装需要在手机「开发者选项」里打开 USB 调试；也可以直接把 APK 发到手机安装。

## 主题与持久化

主题变量在 `src/styles/theme.css`：

- 希罗：黑 / 深红
- 艾玛：白 / 浅粉 / 樱花粉

本地存储键：

- `jxmfun-mobile-character`
- `jxmfun-mobile-scale`
- `jxmfun-mobile-rotate`

## 性能说明

- 默认 30fps，DPR 按设备真实值渲染（上限 3）。
- 使用本地 4096 贴图 + 完整 mipmap 链，缩小人物时也不会出现锯齿。
- 只同时加载一个人物，切换时销毁旧模型。
- App 切到后台时暂停渲染；设置 / 日记弹窗打开时暂停自动轮换。

如果低端机仍然卡顿，可以再把 DPR 上限降到 2，或把 `pixiApp.ticker.maxFPS` 调到 24。

## 素材与授权

- Live2D 模型、图标、`voice/kiang.wav` 来自 B 站 UP 主 **露姆娅**（UID: 1384755）；请遵守原作者的使用授权。
- `public/live2d/core/live2dcubismcore.min.js` 是 Live2D Inc. 的 Redistributable Code，请保留同目录的 `NOTICE.txt`。
- 模型资源不随本项目授予任何再分发许可；公开仓库 / 发布前请确认模型使用授权。

## 已知限制

- 初版只做 Android；iOS 工程可以后续用 `npx cap add ios` 生成，但需要 macOS + Xcode 构建。
- 日记 / 记忆只是占位，没有真实数据。
- 独占全屏游戏 / 系统级悬浮窗不属于本 App 的能力范围。
- 手机端没有「常驻桌面」或「后台悬浮」模式，只有打开 App 时可见。
