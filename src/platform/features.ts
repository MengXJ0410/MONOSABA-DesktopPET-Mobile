/**
 * 手机端功能开关。
 *
 * 桌面专属功能（鼠标穿透、强制顶层、多屏、开机自启、窗口拖拽等）不删除实现思路，
 * 只在这里静默，UI 和交互都不会出现；将来若做平板/桌面模式，可以逐项打开。
 */
export const FEATURES = {
  /** 鼠标穿透（手机端无意义）。 */
  passthrough: false,
  /** 人物不透明度 / 悬停变淡（依赖穿透）。 */
  opacity: false,
  /** 强制顶层。 */
  alwaysOnTop: false,
  /** 开机自启。 */
  autoLaunch: false,
  /** 多屏切换。 */
  displaySwitch: false,
  /** 窗口拖拽 / 位置记忆。 */
  windowDrag: false,
  /** 显示 / 隐藏人物。 */
  showHide: false,
  /** App 内拖动人物。 */
  dragCharacter: false,
  /** 陀螺仪视线。 */
  gyroscope: false,

  /** 自动轮换。 */
  autoRotate: true,
  /** 人物大小滑杆。 */
  scale: true,
  /** 双指缩放。 */
  pinchZoom: true,
  /** 点击震动。 */
  haptics: true,
  /** 日记入口。 */
  diary: true,
  /** 记忆入口（在日记面板底部切换）。 */
  memory: true,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
