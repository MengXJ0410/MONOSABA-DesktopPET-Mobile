import { DIARY_PLACEHOLDER_MESSAGE } from "@/content/live2d";
import type { DiaryPayload, MemoryPayload } from "@/shared/types";

export type DiaryResult =
  | { ok: true; data: DiaryPayload }
  | { ok: false; error: string };

export type MemoryResult =
  | { ok: true; data: MemoryPayload }
  | { ok: false; error: string };

export type UnlockResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 手机端日记 / 记忆通道。
 *
 * 初版只保留接口：不连 SSH、不存私钥、不访问网络。
 * 未来接入时新增一个 HttpDiaryGateway（读取 VITE_DIARY_API_BASE），
 * 返回结构沿用 DiaryPayload / MemoryPayload 即可，UI 不需要改。
 */
export type DiaryGateway = {
  available(): Promise<boolean>;
  unlock(passphrase: string): Promise<UnlockResult>;
  loadDiary(book?: string | null): Promise<DiaryResult>;
  loadMemory(): Promise<MemoryResult>;
};

export const mobileDiaryGateway: DiaryGateway = {
  async available() {
    return true;
  },
  async unlock() {
    return { ok: false, message: DIARY_PLACEHOLDER_MESSAGE };
  },
  async loadDiary() {
    return { ok: false, error: DIARY_PLACEHOLDER_MESSAGE };
  },
  async loadMemory() {
    return { ok: false, error: DIARY_PLACEHOLDER_MESSAGE };
  },
};
