import { Capacitor, registerPlugin } from "@capacitor/core";
import { DIARY_PASSPHRASE } from "@/content/live2d";
import type { DiaryPayload, MemoryPayload } from "@/shared/types";

export type ChannelState =
  | "connected"
  | "idle"
  | "disconnected"
  | "expired"
  | "notInstalled"
  | "forbidden"
  | "unavailable";

export type ChannelStatus = {
  installed: boolean;
  connected: boolean;
  state: ChannelState;
  remainingSeconds: number;
  expiresAt?: number;
  error?: string;
};

export type DiaryResult =
  | { ok: true; data: DiaryPayload }
  | { ok: false; error: string };

export type MemoryResult =
  | { ok: true; data: MemoryPayload }
  | { ok: false; error: string };

export type UnlockResult =
  | { ok: true }
  | { ok: false; message: string };

type BridgeResult = {
  ok: boolean;
  data?: string;
  error?: string;
};

type DiaryBridgePlugin = {
  status(): Promise<ChannelStatus>;
  openConnector(): Promise<{ ok: boolean; error?: string }>;
  loadDiary(options: { book?: string | null }): Promise<BridgeResult>;
  loadMemory(): Promise<BridgeResult>;
};

/**
 * 日记 / 记忆通道。
 *
 * 真正的网络访问和 token 都在原生插件 DiaryBridge 里：它通过 signature 权限的
 * ContentProvider 拿到「魔女小屋钥匙」的本地端口和随机 token，再读取数据。
 * Web 层不接触端口、token 或私钥。
 */
export type DiaryGateway = {
  channelStatus(): Promise<ChannelStatus>;
  openConnector(): Promise<{ ok: boolean; error?: string }>;
  unlock(passphrase: string): Promise<UnlockResult>;
  loadDiary(book?: string | null): Promise<DiaryResult>;
  loadMemory(): Promise<MemoryResult>;
};

const bridge = Capacitor.isNativePlatform()
  ? registerPlugin<DiaryBridgePlugin>("DiaryBridge")
  : null;

const DISCONNECTED: ChannelStatus = {
  installed: false,
  connected: false,
  state: "notInstalled",
  remainingSeconds: 0,
};

function parsePayload<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readChannelStatus(): Promise<ChannelStatus> {
  if (!bridge) {
    return { ...DISCONNECTED, state: "disconnected" };
  }
  try {
    const status = await bridge.status();
    return {
      installed: Boolean(status?.installed),
      connected: Boolean(status?.connected),
      state: (status?.state ?? "disconnected") as ChannelState,
      remainingSeconds: Number(status?.remainingSeconds ?? 0),
      expiresAt: Number(status?.expiresAt ?? 0),
      error: status?.error,
    };
  } catch (error) {
    return {
      ...DISCONNECTED,
      state: "unavailable",
      error: error instanceof Error ? error.message : "读取钥匙状态失败。",
    };
  }
}

export const mobileDiaryGateway: DiaryGateway = {
  channelStatus: readChannelStatus,

  async openConnector() {
    if (!bridge) {
      return { ok: false, error: "当前环境打不开魔女小屋钥匙。" };
    }
    try {
      return await bridge.openConnector();
    } catch {
      return { ok: false, error: "打不开魔女小屋钥匙。" };
    }
  },

  async unlock(passphrase) {
    // 咒语和桌面端一致；真正的读取权限仍然由钥匙是否连接决定。
    if (passphrase.trim() !== DIARY_PASSPHRASE) {
      return { ok: false, message: `咒语不对。正确密钥是 ${DIARY_PASSPHRASE}。` };
    }
    const status = await readChannelStatus();
    if (!status.connected) {
      return { ok: false, message: "钥匙没有连接服务器，日记本还锁着。" };
    }
    return { ok: true };
  },

  async loadDiary(book) {
    if (!bridge) {
      return { ok: false, error: "当前环境没有日记通道。" };
    }
    try {
      const result = await bridge.loadDiary({ book: book ?? null });
      if (!result.ok) {
        return { ok: false, error: result.error || "日记本打不开。" };
      }
      const data = parsePayload<DiaryPayload>(result.data);
      if (!data) return { ok: false, error: "日记本返回格式不正确。" };
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "日记本打不开。",
      };
    }
  },

  async loadMemory() {
    if (!bridge) {
      return { ok: false, error: "当前环境没有记忆通道。" };
    }
    try {
      const result = await bridge.loadMemory();
      if (!result.ok) {
        return { ok: false, error: result.error || "记忆暂时打不开。" };
      }
      const data = parsePayload<MemoryPayload>(result.data);
      if (!data) return { ok: false, error: "记忆返回格式不正确。" };
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "记忆暂时打不开。",
      };
    }
  },
};
