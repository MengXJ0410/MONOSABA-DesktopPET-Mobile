"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Companion } from "@/components/companion/companion";
import { DiaryGate } from "@/components/diary/diary-gate";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import {
  LIVE2D_CHARACTERS,
  MOBILE_APP_NAME,
  type Live2DCharacterId,
  type Live2DRotateSettings,
} from "@/content/live2d";
import {
  clampRotateSeconds,
  clampScale,
  persistCharacter,
  persistRotate,
  persistScale,
  randomBetween,
  readCharacter,
  readRotate,
  readScale,
} from "@/lib/storage";
import {
  applyStatusBar,
  initNative,
  registerAppState,
  registerBackButton,
  tapHaptic,
} from "@/platform/native";

import styles from "./app.module.css";

export default function App() {
  const [character, setCharacter] = useState<Live2DCharacterId>(() =>
    readCharacter(),
  );
  const [scale, setScale] = useState(() => readScale());
  const [rotate, setRotate] = useState<Live2DRotateSettings>(() =>
    readRotate(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(text);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    void initNative(readCharacter());
    return registerAppState(setAppActive);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.petCharacter = character;
    document.documentElement.dataset.colorMode =
      character === "hiro" ? "dark" : "light";
    document.title = `${MOBILE_APP_NAME} · ${LIVE2D_CHARACTERS[character].name}`;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute(
      "content",
      character === "hiro" ? "#0a0507" : "#ffe6ef",
    );
    persistCharacter(character);
    void applyStatusBar(character);
  }, [character]);

  useEffect(() => {
    const timer = window.setTimeout(() => persistScale(scale), 250);
    return () => window.clearTimeout(timer);
  }, [scale]);

  useEffect(() => {
    persistRotate(rotate);
  }, [rotate]);

  // 自动轮换：每次切换后重新随机一个间隔；面板打开或 App 在后台时暂停。
  useEffect(() => {
    if (!rotate.enabled || settingsOpen || diaryOpen || !appActive) return;
    const delay = randomBetween(rotate.minSeconds, rotate.maxSeconds) * 1000;
    const timer = window.setTimeout(() => {
      setCharacter((previous) => (previous === "hiro" ? "ema" : "hiro"));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    appActive,
    character,
    diaryOpen,
    rotate.enabled,
    rotate.maxSeconds,
    rotate.minSeconds,
    settingsOpen,
  ]);

  // Android 返回键：先关日记 / 设置，再双击退出。
  useEffect(() => {
    return registerBackButton({
      onBack: () => {
        if (diaryOpen) {
          setDiaryOpen(false);
          return true;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }
        return false;
      },
      onExitHint: () => showToast("再按一次返回键退出"),
    });
  }, [diaryOpen, settingsOpen, showToast]);

  const switchCharacter = useCallback(() => {
    setCharacter((previous) => (previous === "hiro" ? "ema" : "hiro"));
    void tapHaptic();
  }, []);

  const changeScale = useCallback((value: number) => {
    setScale(clampScale(value));
  }, []);

  const commitScale = useCallback((value: number) => {
    persistScale(clampScale(value));
  }, []);

  const toggleRotate = useCallback(() => {
    setRotate((previous) => ({ ...previous, enabled: !previous.enabled }));
    void tapHaptic();
  }, []);

  const changeRotateRange = useCallback(
    (minSeconds: number, maxSeconds: number) => {
      setRotate((previous) => {
        const minimum = clampRotateSeconds(minSeconds, previous.minSeconds);
        const maximum = Math.max(
          minimum,
          clampRotateSeconds(maxSeconds, previous.maxSeconds),
        );
        return { ...previous, minSeconds: minimum, maxSeconds: maximum };
      });
    },
    [],
  );

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    void tapHaptic();
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const openDiary = useCallback(() => {
    setSettingsOpen(false);
    setDiaryOpen(true);
  }, []);

  const closeDiary = useCallback(() => {
    setDiaryOpen(false);
  }, []);

  const handleTap = useCallback(() => {
    void tapHaptic();
  }, []);

  const profile = LIVE2D_CHARACTERS[character];

  return (
    <div className={styles.app}>
      <Companion
        character={character}
        scale={scale}
        paused={!appActive}
        onScaleChange={changeScale}
        onScaleCommit={commitScale}
        onTap={handleTap}
      />

      <button
        type="button"
        className={`${styles.settingsButton}${
          settingsOpen || diaryOpen ? ` ${styles.settingsButtonHidden}` : ""
        }`}
        aria-label={`打开${profile.name}的设置`}
        aria-expanded={settingsOpen}
        onClick={openSettings}
      >
        <img src={profile.iconPath} alt="" aria-hidden="true" draggable={false} />
      </button>

      <SettingsSheet
        open={settingsOpen}
        character={character}
        scale={scale}
        rotate={rotate}
        onClose={closeSettings}
        onSwitchCharacter={switchCharacter}
        onScaleChange={changeScale}
        onToggleRotate={toggleRotate}
        onRotateRangeChange={changeRotateRange}
        onOpenDiary={openDiary}
      />

      <DiaryGate open={diaryOpen} onClose={closeDiary} />

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
