/** 日记本文件信息（与桌面端保持一致，方便未来直接复用服务端返回结构）。 */
export type DiaryBook = {
  name: string;
  size: number;
  mtime: number;
};

export type DiaryPayload = DiaryBook & {
  books: DiaryBook[];
  book: string | null;
  content: string;
  truncated: boolean;
};

/** 一条长久记忆，对应 AstrBot 插件 memory/YYYY-MM-DD.jsonl 的一行。 */
export type MemoryEntry = {
  date: string;
  /** 事实 / 事件 / 偏好 / 情绪 / 约定 / 关系 / 画像 / 日记 */
  kind: string;
  /** 1–5，数值越大越重要。 */
  imp: number;
  text: string;
  /** diary 或 qq... 等来源域。 */
  scope: string;
};

export type MemoryPayload = {
  entries: MemoryEntry[];
  /** 有记忆的天数。 */
  days: number;
  count: number;
};
