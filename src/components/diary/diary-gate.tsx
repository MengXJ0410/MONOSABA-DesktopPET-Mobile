"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { mobileDiaryGateway } from "@/lib/diary/gateway";

import styles from "./diary-gate.module.css";

type DiaryGateProps = {
  open: boolean;
  onClose: () => void;
};

export function DiaryGate({ open, onClose }: DiaryGateProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassphrase("");
    setError(null);
    setSubmitting(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 220);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      void Keyboard.hide().catch(() => undefined);
    };
  }, [onClose, open]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await mobileDiaryGateway.unlock(passphrase);
    await Keyboard.hide().catch(() => undefined);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setShakeKey((value) => value + 1);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="希罗的日记"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          aria-label="关闭日记"
          onClick={onClose}
        >
          ×
        </button>

        <div className={styles.lock} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <rect
              x="5"
              y="10"
              width="14"
              height="10"
              rx="2.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="12" cy="15" r="1.25" fill="currentColor" />
          </svg>
        </div>

        <h2 className={styles.title}>希罗的日记</h2>
        <p className={styles.subtitle}>只有希罗知道咒语。</p>

        <form className={styles.form} onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            type="password"
            value={passphrase}
            placeholder="咒语"
            aria-label="日记咒语"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            onChange={(event) => {
              setPassphrase(event.target.value);
              if (error) setError(null);
            }}
          />
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "正在翻开……" : "翻开"}
          </button>
        </form>

        {error ? (
          <p key={shakeKey} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <p className={styles.note}>
          手机版的日记通道还在准备中，先耐心等一等。
        </p>
      </section>
    </div>
  );
}
