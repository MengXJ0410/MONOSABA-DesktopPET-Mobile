import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Live2DCharacterId } from "@/content/live2d";

export const isNative = Capacitor.isNativePlatform();

/** 让状态栏图标与当前人物主题匹配：希罗深色底用浅色图标，艾玛浅色底用深色图标。 */
export async function applyStatusBar(character: Live2DCharacterId): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: "#00000000" });
    await StatusBar.setStyle({
      // Capacitor 的命名按背景色：Dark = 深色背景/浅色图标，Light = 浅色背景/深色图标。
      style: character === "hiro" ? Style.Dark : Style.Light,
    });
  } catch (error) {
    console.warn("[native] status bar failed", error);
  }
}

/** App 启动时的原生初始化：竖屏锁定、沉浸式状态栏、隐藏启动图。 */
export async function initNative(character: Live2DCharacterId): Promise<void> {
  if (!isNative) return;
  try {
    await ScreenOrientation.lock({ orientation: "portrait" });
  } catch (error) {
    console.warn("[native] orientation lock failed", error);
  }
  await applyStatusBar(character);
  try {
    await SplashScreen.hide();
  } catch (error) {
    console.warn("[native] splash hide failed", error);
  }
}

export async function tapHaptic(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // 部分设备不支持震动，忽略即可。
  }
}

type BackButtonOptions = {
  /** 返回 true 表示已消费（例如关闭了面板 / 弹窗）。 */
  onBack: () => boolean;
  /** 第一次按返回键、还没退出时调用。 */
  onExitHint: () => void;
};

/** 注册 Android 返回键：先关面板，再双击退出。 */
export function registerBackButton(options: BackButtonOptions): () => void {
  if (!isNative) return () => undefined;

  let lastBackAt = 0;
  const listener = App.addListener("backButton", () => {
    if (options.onBack()) return;
    const now = Date.now();
    if (now - lastBackAt < 2000) {
      void App.exitApp();
      return;
    }
    lastBackAt = now;
    options.onExitHint();
  });

  return () => {
    void listener.then((handle) => handle.remove());
  };
}

/** 监听 App 前后台切换，用于暂停 / 恢复 Live2D 渲染。 */
export function registerAppState(
  handler: (isActive: boolean) => void,
): () => void {
  if (!isNative) {
    const onVisibility = () => handler(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }

  const listener = App.addListener("appStateChange", ({ isActive }) => {
    handler(isActive);
  });
  return () => {
    void listener.then((handle) => handle.remove());
  };
}
