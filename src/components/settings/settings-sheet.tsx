"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  LIVE2D_CHARACTERS,
  LIVE2D_ROTATE_MAX_SECONDS,
  LIVE2D_ROTATE_MIN_SECONDS,
  LIVE2D_ROTATE_STEP_SECONDS,
  LIVE2D_SIZE_MAX,
  LIVE2D_SIZE_MIN,
  LIVE2D_SIZE_STEP,
  MOBILE_APP_NAME,
  MOBILE_APP_VERSION,
  type Live2DCharacterId,
  type Live2DRotateSettings,
} from "@/content/live2d";
import { FEATURES } from "@/platform/features";

import styles from "./settings-sheet.module.css";

type SettingsSheetProps = {
  open: boolean;
  character: Live2DCharacterId;
  scale: number;
  rotate: Live2DRotateSettings;
  onClose: () => void;
  onSwitchCharacter: () => void;
  onScaleChange: (value: number) => void;
  onToggleRotate: () => void;
  onRotateRangeChange: (minSeconds: number, maxSeconds: number) => void;
  onOpenDiary: () => void;
};

export function SettingsSheet({
  open,
  character,
  scale,
  rotate,
  onClose,
  onSwitchCharacter,
  onScaleChange,
  onToggleRotate,
  onRotateRangeChange,
  onOpenDiary,
}: SettingsSheetProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const profile = LIVE2D_CHARACTERS[character];
  const nextId: Live2DCharacterId = character === "hiro" ? "ema" : "hiro";
  const nextProfile = LIVE2D_CHARACTERS[nextId];
  const progress =
    ((scale - LIVE2D_SIZE_MIN) / (LIVE2D_SIZE_MAX - LIVE2D_SIZE_MIN)) * 100;
  const rotateProgress = (value: number) =>
    ((value - LIVE2D_ROTATE_MIN_SECONDS) /
      (LIVE2D_ROTATE_MAX_SECONDS - LIVE2D_ROTATE_MIN_SECONDS)) *
    100;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name}的设置`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />

        <header className={styles.header}>
          <div>
            <span className={styles.appName}>{MOBILE_APP_NAME}</span>
            <h2 className={styles.title}>{profile.name}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            aria-label="关闭设置"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <button
              type="button"
              className={styles.characterButton}
              onClick={onSwitchCharacter}
            >
              <img
                className={styles.characterIcon}
                src={nextProfile.iconPath}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className={styles.characterText}>
                <span className={styles.characterName}>{nextProfile.name}</span>
                <span className={styles.characterHint}>切换到{nextProfile.name}</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                →
              </span>
            </button>
          </section>

          {FEATURES.scale ? (
            <section className={styles.section}>
              <div className={styles.row}>
                <span className={styles.label}>人物大小</span>
                <span className={styles.value}>{scale}%</span>
              </div>
              <input
                className={styles.slider}
                type="range"
                min={LIVE2D_SIZE_MIN}
                max={LIVE2D_SIZE_MAX}
                step={LIVE2D_SIZE_STEP}
                value={scale}
                style={{ "--range-progress": `${progress}%` } as CSSProperties}
                aria-label="人物大小"
                onChange={(event) => onScaleChange(Number(event.target.value))}
              />
              <p className={styles.hint}>也可以在人物上用双指缩放。</p>
            </section>
          ) : null}

          {FEATURES.autoRotate ? (
            <section className={styles.section}>
              <div className={styles.row}>
                <div>
                  <span className={styles.label}>自动轮换</span>
                  <p className={styles.hint}>
                    按随机间隔在希罗和艾玛之间切换。
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rotate.enabled}
                  aria-label="自动轮换"
                  className={`${styles.switch}${rotate.enabled ? ` ${styles.switchOn}` : ""}`}
                  onClick={onToggleRotate}
                >
                  <span className={styles.switchKnob} aria-hidden="true" />
                </button>
              </div>

              {rotate.enabled ? (
                <div className={styles.rotateBox}>
                  <label className={styles.rangeRow}>
                    <span>最短周期</span>
                    <b>{rotate.minSeconds} 秒</b>
                    <input
                      className={styles.slider}
                      type="range"
                      min={LIVE2D_ROTATE_MIN_SECONDS}
                      max={LIVE2D_ROTATE_MAX_SECONDS}
                      step={LIVE2D_ROTATE_STEP_SECONDS}
                      value={rotate.minSeconds}
                      aria-label="自动轮换最短周期"
                      style={
                        {
                          "--range-progress": `${rotateProgress(rotate.minSeconds)}%`,
                        } as CSSProperties
                      }
                      onChange={(event) =>
                        onRotateRangeChange(
                          Math.min(
                            Number(event.target.value),
                            rotate.maxSeconds,
                          ),
                          rotate.maxSeconds,
                        )
                      }
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>最长周期</span>
                    <b>{rotate.maxSeconds} 秒</b>
                    <input
                      className={styles.slider}
                      type="range"
                      min={LIVE2D_ROTATE_MIN_SECONDS}
                      max={LIVE2D_ROTATE_MAX_SECONDS}
                      step={LIVE2D_ROTATE_STEP_SECONDS}
                      value={rotate.maxSeconds}
                      aria-label="自动轮换最长周期"
                      style={
                        {
                          "--range-progress": `${rotateProgress(rotate.maxSeconds)}%`,
                        } as CSSProperties
                      }
                      onChange={(event) =>
                        onRotateRangeChange(
                          rotate.minSeconds,
                          Math.max(
                            Number(event.target.value),
                            rotate.minSeconds,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          {FEATURES.diary && character === "hiro" ? (
            <section className={styles.section}>
              <button
                type="button"
                className={styles.diaryButton}
                onClick={onOpenDiary}
              >
                <span className={styles.diaryText}>
                  <span className={styles.label}>偷看日记</span>
                  <span className={styles.hint}>希罗好像把日记藏起来了。</span>
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  →
                </span>
              </button>
            </section>
          ) : null}

          <section className={styles.about}>
            <span>
              {MOBILE_APP_NAME} · v{MOBILE_APP_VERSION}
            </span>
            <span>Live2D 资源：B 站 UP 主露姆娅（UID:1384755）</span>
            <span>手机版专注 App 内陪伴，桌面专属功能未启用。</span>
          </section>
        </div>
      </section>
    </div>
  );
}
