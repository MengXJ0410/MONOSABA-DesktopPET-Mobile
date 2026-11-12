# 魔女小屋 / MONOSABA Mobile

希罗 / 艾玛 Live2D 手机应用。界面、模型和台词沿用桌面版 `MONOSABA-DesktopPET`，但不再做桌面桌宠，只在打开 App 时陪伴。

- 应用名：**魔女小屋**
- 包名：`com.mengxj.monosaba.mobile`
- 版本：`0.2.0-beta`（versionCode 2）
- 目标平台：Android 8.0+（minSdk 26），锁定竖屏

配套应用 **魔女小屋钥匙**（`com.mengxj.monosaba.key`）负责只读访问服务器上的日记与记忆，两个 App 使用同一张私有 keystore 签名。

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
- **日记 / 记忆**：希罗的设置里显示日记通道状态，经「魔女小屋钥匙」解锁后阅读日记与记忆（详见下文）。

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
| 陀螺仪视线 | 静默 |

手机端保留的模块：人物模型、切换人物、人物大小、自动轮换、点击表情 / 气泡 / 音效、待机视线、主题、自动保存、日记 / 记忆。

## 日记 / 记忆

日记和记忆都由独立应用 **魔女小屋钥匙** 提供：钥匙用只读 SSH key 通过 SFTP 下载 `.md` / `.jsonl` 并在本地解析，主 App 只通过本机 HTTP（`127.0.0.1` + 随机端口 + token）取 JSON，私钥和服务器地址都不会进入 WebView。手机需要先加入和服务器相同的 EasyTier 网络。

- 设置里的「日记通道」显示 **已连接 / 未连接 / 已到期 / 未安装钥匙 / 签名不一致**，并带倒计时和「打开钥匙」按钮。
- 钥匙每次连接 5 分钟，可手动 +5 分钟；从点击连接开始计时，到期自动断开。
- 未连接时日记面板提示 **「希罗酱不想给你看日记」**。
- 已连接后输入咒语 `hiro110`（输错会提示正确密钥）解锁；断线会立即清空内容并重新上锁。
- 日记按「日记本.md」的卷号选择，超过 4 MB 只读最新部分。
- 记忆只在切到记忆页时加载，按 6 路并行读取；钥匙进程内缓存 2 分钟，来回切换不会重复下载。

原生桥在 `android/app/src/main/java/com/mengxj/monosaba/mobile/DiaryBridgePlugin.java`，JS 侧接口在 `src/lib/diary/gateway.ts`：

```ts
type DiaryGateway = {
  channelStatus(): Promise<ChannelStatus>;
  openConnector(): Promise<{ ok: boolean; error?: string }>;
  unlock(passphrase: string): Promise<UnlockResult>;
  loadDiary(book?: string | null): Promise<DiaryResult>;
  loadMemory(): Promise<MemoryResult>;
};
```

钥匙的状态通过 `signature` 权限的 ContentProvider 暴露，只有同签名的 App 能读取。

## 目录

```text
src/
├─ components/
│  ├─ companion/        # 全屏舞台、模型、点击、视线、气泡
│  ├─ settings/         # 底部设置抽屉、日记通道状态
│  └─ diary/            # 日记 / 记忆面板、咒语解锁
├─ content/live2d.ts    # 人物、台词、表情、缩放/轮换常量
├─ lib/live2d/          # 待机视线、点击音效规则
├─ lib/diary/           # 原生桥封装、Markdown / JSONL 解析
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
release/MONOSABA-Mobile-0.2.0-beta-debug.apk
```

（版本号从 `package.json` 读取，APK 名自动同步。）

安装到手机：

```powershell
D:\Android\Sdk\platform-tools\adb.exe install -r release\MONOSABA-Mobile-0.2.0-beta-debug.apk
```

首次安装需要在手机「开发者选项」里打开 USB 调试；也可以直接把 APK 发到手机安装。

## 签名

主 App 与「魔女小屋钥匙」必须使用同一张 keystore 签名，否则 ContentProvider 的 `signature` 权限会拒绝读取。

- keystore：`D:\funtools\monosabapet\keystore\monosaba.jks`（密码在 `keystore.properties`，两个工程都通过 `local.properties` 引用，均已 gitignore）
- 证书 SHA-256：`b260db1c52ef41a5cc90cb0a4d0475735adc172140e72705a2dda473365e3994`

`0.1.0` 用的是另一套调试签名，安装新版前需要先卸载旧版；卸载会清空本地设置。

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

- 只做 Android；iOS 工程可以后续用 `npx cap add ios` 生成，但需要 macOS + Xcode 构建。
- 日记 / 记忆依赖「魔女小屋钥匙」，钥匙未连接或已到期时日记不可读。
- 独占全屏游戏 / 系统级悬浮窗不属于本 App 的能力范围。
- 手机端没有「常驻桌面」或「后台悬浮」模式，只有打开 App 时可见。
- 部分国产系统（如 ColorOS）会限制后台前台服务，需要给钥匙关闭电池优化 / 允许自启动。
