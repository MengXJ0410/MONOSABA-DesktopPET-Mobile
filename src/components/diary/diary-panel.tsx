"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Keyboard } from "@capacitor/keyboard";
import {
  DIARY_PLACEHOLDER_MESSAGE,
  MOBILE_CONNECTOR_NAME,
} from "@/content/live2d";
import {
  mobileDiaryGateway,
  type ChannelStatus,
} from "@/lib/diary/gateway";
import { parseEntries } from "@/lib/diary/parse";
import type { DiaryPayload, MemoryEntry, MemoryPayload } from "@/shared/types";

import styles from "./diary-panel.module.css";

type DiaryView = "diary" | "memory";

type DiaryPanelProps = {
  open: boolean;
  onClose: () => void;
};

const MEMORY_ICON_PATH = "/live2d/ui/hiro-memory.png";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function ReloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 日记正文里的链接不跳转，避免把 App 的 WebView 带走。 */
const markdownComponents = {
  a: ({ children }: { children?: ReactNode }) => (
    <span className={styles.linkText}>{children}</span>
  ),
};

export function DiaryPanel({ open, onClose }: DiaryPanelProps) {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const [passphrase, setPassphrase] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [connectorError, setConnectorError] = useState<string | null>(null);

  const [books, setBooks] = useState<{ name: string; size: number; mtime: number }[]>([]);
  const [book, setBook] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [size, setSize] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<DiaryView>("diary");
  const [memory, setMemory] = useState<MemoryPayload | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const unlockedRef = useRef(false);
  const mountedRef = useRef(true);
  const memoryInFlightRef = useRef(false);

  unlockedRef.current = unlocked;

  const resetData = useCallback(() => {
    setBooks([]);
    setBook(null);
    setContent("");
    setSize(0);
    setTruncated(false);
    setLoading(false);
    setError(null);
    setView("diary");
    setMemory(null);
    setMemoryLoading(false);
    setMemoryError(null);
    setKeyError(null);
    setPassphrase("");
    setChecking(false);
  }, []);

  const lockNow = useCallback((notice: string | null) => {
    setUnlocked(false);
    resetData();
    setLockNotice(notice);
    void Keyboard.hide().catch(() => undefined);
  }, [resetData]);

  const applyPayload = useCallback((data: DiaryPayload) => {
    setBooks(Array.isArray(data.books) ? data.books : []);
    setBook(typeof data.book === "string" ? data.book : null);
    setContent(typeof data.content === "string" ? data.content : "");
    setSize(typeof data.size === "number" ? data.size : 0);
    setTruncated(data.truncated === true);
    setError(null);
    setLoading(false);
  }, []);

  const load = useCallback(async (target?: string | null) => {
    setLoading(true);
    setError(null);
    const result = await mobileDiaryGateway.loadDiary(target ?? null);
    if (!mountedRef.current) return;
    if (result.ok) {
      applyPayload(result.data);
    } else {
      setError(result.error);
      setLoading(false);
    }
  }, [applyPayload]);

  const loadMemory = useCallback(async () => {
    if (memoryInFlightRef.current) return;
    memoryInFlightRef.current = true;
    setMemoryLoading(true);
    setMemoryError(null);
    const result = await mobileDiaryGateway.loadMemory();
    if (!mountedRef.current) {
      memoryInFlightRef.current = false;
      return;
    }
    if (result.ok) setMemory(result.data);
    else setMemoryError(result.error);
    memoryInFlightRef.current = false;
    setMemoryLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 每次打开都从“上锁”状态开始，并重新检查钥匙。
  useEffect(() => {
    if (!open) {
      void Keyboard.hide().catch(() => undefined);
      return;
    }
    setStatus(null);
    setUnlocked(false);
    resetData();
    setLockNotice(null);
    setConnectorError(null);
  }, [open, resetData]);

  // 打开期间每 4 秒检查一次钥匙；一旦断线立即重新上锁并清空内容。
  useEffect(() => {
    if (!open) return;
    let active = true;

    const check = async () => {
      const next = await mobileDiaryGateway.channelStatus();
      if (!active) return;
      setStatus(next);
      if (unlockedRef.current && !next.connected) {
        lockNow("钥匙断开了，日记重新上锁。");
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, lockNow]);

  // 钥匙可用且还没解锁时自动聚焦咒语输入框。
  useEffect(() => {
    if (!open || unlocked || !status?.connected) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 240);
    return () => window.clearTimeout(timer);
  }, [open, status?.connected, unlocked]);

  const entries = useMemo(() => parseEntries(content), [content]);
  const memoryGroups = useMemo(() => {
    if (!memory) return [] as Array<{ date: string; items: MemoryEntry[] }>;
    const groups = new Map<string, MemoryEntry[]>();
    for (const entry of memory.entries) {
      const items = groups.get(entry.date);
      if (items) items.push(entry);
      else groups.set(entry.date, [entry]);
    }
    return Array.from(groups, ([date, items]) => ({ date, items }));
  }, [memory]);

  const meta = book ? `${formatSize(size)} · ${entries.length} 篇` : "";
  const memoryMeta = memory
    ? `${memory.count} 条 · ${memory.days} 天`
    : memoryLoading
      ? "正在回忆……"
      : "";
  const connected = status?.connected === true;

  // 所有 Hook 都已执行完，这里再按 open 提前返回，避免 Hook 数量变化。
  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    setKeyError(null);
    const result = await mobileDiaryGateway.unlock(passphrase);
    await Keyboard.hide().catch(() => undefined);
    setChecking(false);
    if (!result.ok) {
      setKeyError(result.message);
      setShakeKey((value) => value + 1);
      return;
    }
    setPassphrase("");
    setUnlocked(true);
    setLockNotice(null);
    void load(null);
  };

  const openConnector = async () => {
    setConnectorError(null);
    const result = await mobileDiaryGateway.openConnector();
    if (!result.ok) setConnectorError(result.error ?? "打不开钥匙。");
  };

  const toggleView = () => {
    const next: DiaryView = view === "memory" ? "diary" : "memory";
    if (next === "memory" && !memory && !memoryLoading) void loadMemory();
    setView(next);
    window.setTimeout(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }, 0);
  };

  const reload = () => {
    if (view === "memory") void loadMemory();
    else void load(book);
  };

  const requestClose = () => {
    void Keyboard.hide().catch(() => undefined);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={requestClose}>
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={view === "memory" ? "希罗的记忆" : "希罗的日记"}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.title}>
              {view === "memory" ? "希罗的记忆" : "希罗的日记"}
            </span>
            {unlocked ? (
              <span className={styles.meta}>
                {view === "memory" ? memoryMeta : meta}
                {status ? ` · 钥匙 ${formatRemaining(status.remainingSeconds)}` : ""}
              </span>
            ) : null}
          </div>

          {unlocked && view === "diary" && books.length > 1 ? (
            <select
              className={styles.select}
              value={book ?? ""}
              aria-label="选择日记本"
              disabled={loading}
              onChange={(event) => void load(event.target.value)}
            >
              {books.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            className={styles.close}
            aria-label="关闭日记"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        {status === null ? (
          <div className={styles.centerState}>
            <p className={styles.hint}>正在检查日记通道……</p>
          </div>
        ) : !connected ? (
          <div className={styles.centerState}>
            <div className={styles.lockIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="12" cy="15" r="1.25" fill="currentColor" />
              </svg>
            </div>
            <h2 className={styles.stateTitle}>希罗的日记</h2>
            <p className={styles.placeholder}>{DIARY_PLACEHOLDER_MESSAGE}</p>
            <p className={styles.note}>
              {status.state === "notInstalled"
                ? `先安装「${MOBILE_CONNECTOR_NAME}」，连接服务器后这里会变成咒语输入。`
                : status.state === "expired"
                  ? "钥匙的连接已经到期。打开钥匙重新连接，日记本才会解锁。"
                  : status.state === "forbidden"
                    ? "两个应用的签名不一致，系统拒绝了日记通道。"
                    : "打开钥匙并连接服务器，才能解锁日记本。"}
            </p>
            {lockNotice ? <p className={styles.notice}>{lockNotice}</p> : null}
            {status.error ? <p className={styles.error}>{status.error}</p> : null}
            {connectorError ? <p className={styles.error}>{connectorError}</p> : null}
            <div className={styles.actions}>
              {status.state !== "notInstalled" ? (
                <button type="button" className={styles.primary} onClick={() => void openConnector()}>
                  打开{MOBILE_CONNECTOR_NAME}
                </button>
              ) : (
                <button type="button" className={styles.secondary} onClick={() => void openConnector()}>
                  尝试打开钥匙
                </button>
              )}
            </div>
          </div>
        ) : !unlocked ? (
          <div className={styles.centerState}>
            <div className={styles.lockIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="12" cy="15" r="1.25" fill="currentColor" />
              </svg>
            </div>
            <h2 className={styles.stateTitle}>希罗的日记</h2>
            <p className={styles.subtitle}>视奸日记需要希罗の咒语。</p>

            <form className={styles.form} onSubmit={submit}>
              <input
                ref={inputRef}
                className={styles.input}
                type="password"
                value={passphrase}
                placeholder="咒语"
                aria-label="希罗的咒语"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                onChange={(event) => {
                  setPassphrase(event.target.value);
                  if (keyError) setKeyError(null);
                }}
              />
              <button type="submit" className={styles.primary} disabled={checking || !passphrase.trim()}>
                {checking ? "正在念咒……" : "翻开日记"}
              </button>
            </form>

            {keyError ? (
              <p key={shakeKey} className={styles.error} role="alert">
                {keyError}
              </p>
            ) : null}
            {lockNotice ? <p className={styles.notice}>{lockNotice}</p> : null}
            <p className={styles.note}>钥匙剩余 {formatRemaining(status.remainingSeconds)}，断线后日记会立即重新上锁。</p>
          </div>
        ) : (
          <>
            <div className={styles.body} ref={bodyRef}>
              {view === "diary" ? (
                <>
                  {loading ? <p className={styles.hint}>正在翻日记本……</p> : null}
                  {!loading && error ? <p className={styles.error}>{error}</p> : null}
                  {!loading && !error && entries.length === 0 ? (
                    <p className={styles.hint}>希罗还没写日记。</p>
                  ) : null}
                  {!loading && !error
                    ? entries.map((entry) => (
                        <article key={entry.id} className={styles.entry}>
                          <h3 className={styles.entryTitle}>{entry.title}</h3>
                          <div className={styles.markdown}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {entry.body}
                            </ReactMarkdown>
                          </div>
                        </article>
                      ))
                    : null}
                </>
              ) : (
                <>
                  {memoryLoading && !memory ? <p className={styles.hint}>正在回忆……</p> : null}
                  {!memoryLoading && memoryError ? <p className={styles.error}>{memoryError}</p> : null}
                  {!memoryLoading && !memoryError && memory && memory.entries.length === 0 ? (
                    <p className={styles.hint}>希罗什么也想不起来。</p>
                  ) : null}
                  <div className={styles.memoryList}>
                    {memoryGroups.map((group) => (
                      <section key={group.date} className={styles.memoryDay}>
                        <h3 className={styles.memoryDate}>{group.date}</h3>
                        {group.items.map((entry, index) => (
                          <article key={`${group.date}-${index}`} className={styles.memoryItem}>
                            <div className={styles.memoryMetaRow}>
                              <span className={styles.memoryKind}>{entry.kind || "记忆"}</span>
                              {entry.imp > 0 ? (
                                <span className={styles.memoryStars} aria-label={`重要度 ${entry.imp}`}>
                                  {"★".repeat(Math.max(0, Math.min(5, entry.imp)))}
                                </span>
                              ) : null}
                              <span className={styles.memoryScope}>
                                {entry.scope === "diary" ? "日记" : "对话"}
                              </span>
                            </div>
                            {entry.kind === "日记" ? (
                              <div className={styles.markdown}>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents}
                                >
                                  {entry.text}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <p className={styles.memoryText}>{entry.text}</p>
                            )}
                          </article>
                        ))}
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>

            <footer className={styles.footer}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="重新载入"
                title="重新载入"
                disabled={loading || memoryLoading}
                onClick={reload}
              >
                <ReloadIcon />
              </button>
              {truncated && view === "diary" ? (
                <span className={styles.footerNotice}>超过 4MB，只显示最新部分。</span>
              ) : null}
              <button
                type="button"
                className={`${styles.memoryEntry}${view === "memory" ? ` ${styles.memoryEntryActive}` : ""}`}
                aria-label={view === "memory" ? "返回日记" : "查看记忆"}
                aria-pressed={view === "memory"}
                onClick={toggleView}
              >
                <img src={MEMORY_ICON_PATH} alt="" aria-hidden="true" draggable={false} />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
