/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 构建时选择首次启动的默认人物：hiro / ema。 */
  readonly VITE_DEFAULT_CHARACTER?: string;
  /** 预留：未来日记 / 记忆 HTTP API 的根地址。 */
  readonly VITE_DIARY_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
