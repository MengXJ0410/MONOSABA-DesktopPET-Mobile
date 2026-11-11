"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Application } from "pixi.js";
import type { Live2DModel } from "untitled-pixi-live2d-engine/cubism";
import {
  LIVE2D_CHARACTERS,
  LIVE2D_CLICK_HOLD_MS,
  LIVE2D_CORE_PATH,
  LIVE2D_EXPRESSION_LINES,
  LIVE2D_GREETINGS,
  LIVE2D_IDLE_LINES,
  LIVE2D_IDLE_LEAVE_MS,
  LIVE2D_IDLE_POSE_FIRST_MAX_MS,
  LIVE2D_IDLE_POSE_FIRST_MIN_MS,
  LIVE2D_IDLE_POSE_HOLD_MAX_MS,
  LIVE2D_IDLE_POSE_HOLD_MIN_MS,
  LIVE2D_IDLE_POSE_REPEAT_MAX_MS,
  LIVE2D_IDLE_POSE_REPEAT_MIN_MS,
  LIVE2D_IDLE_POSE_RETRY_MAX_MS,
  LIVE2D_IDLE_POSE_RETRY_MIN_MS,
  LIVE2D_IDLE_STILL_MS,
  LIVE2D_TAP_LINES,
  type Live2DCharacterId,
  type Live2DExpression,
} from "@/content/live2d";
import { shouldPlayClickSound } from "@/lib/live2d/click-sound";
import {
  advanceIdleGaze,
  createIdleGaze,
  type IdleGazeState,
} from "@/lib/live2d/idle";
import {
  clamp,
  clampScale,
  pick,
  randomBetween,
} from "@/lib/storage";
import { FEATURES } from "@/platform/features";

import styles from "./companion.module.css";

const BUBBLE_DURATION_MS = 6200;
const GREETING_DELAY_MS = 800;
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 600;
const PINCH_MIN_DISTANCE_PX = 20;
const BOUNDS_REFRESH_MS = 250;

type CompanionStatus = "loading" | "ready" | "error";

type CharacterBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BubbleAnchor = {
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

type ParameterCore = {
  setParameterValueById: (id: unknown, value: number) => void;
};

type ParameterHandleSource = {
  getIdSafe?: (name: string) => unknown;
  idManager?: { getId: (name: string) => unknown };
};

type CompanionProps = {
  character: Live2DCharacterId;
  scale: number;
  paused: boolean;
  onScaleChange: (scale: number) => void;
  onScaleCommit: (scale: number) => void;
  onTap?: () => void;
};

let cubismCorePromise: Promise<void> | null = null;
let pluginRegistered = false;
let cubismConfigured = false;

function loadCubismCore(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Live2D core needs a browser"));
  }
  const scope = window as Window & { Live2DCubismCore?: unknown };
  if (scope.Live2DCubismCore) return Promise.resolve();
  if (cubismCorePromise) return cubismCorePromise;

  cubismCorePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LIVE2D_CORE_PATH;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      cubismCorePromise = null;
      script.remove();
      reject(new Error("Failed to load Live2D Cubism Core"));
    };
    document.head.appendChild(script);
  });

  return cubismCorePromise;
}

function getParameterId(model: Live2DModel, name: string): unknown {
  const internal = model.internalModel as unknown as ParameterHandleSource;
  if (internal.getIdSafe) return internal.getIdSafe(name);
  if (internal.idManager) return internal.idManager.getId(name);
  return name;
}

function safeDestroy(action: () => void) {
  try {
    action();
  } catch (error) {
    console.warn("[live2d] cleanup failed", error);
  }
}

export function Companion({
  character,
  scale,
  paused,
  onScaleChange,
  onScaleCommit,
  onTap,
}: CompanionProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const baseScaleRef = useRef(0);
  const scaleRef = useRef(scale);
  const pausedRef = useRef(paused);
  const characterBoxRef = useRef<CharacterBox | null>(null);
  const bubbleAnchorRef = useRef<BubbleAnchor | null>(null);
  const refreshBoundsRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef<Point | null>(null);
  const pointerLastAtRef = useRef(0);
  const pointerLeftAtRef = useRef(0);
  const bubbleTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onScaleChange, onScaleCommit, onTap });

  const [status, setStatus] = useState<CompanionStatus>("loading");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleAnchor, setBubbleAnchor] = useState<BubbleAnchor | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const characterProfile = LIVE2D_CHARACTERS[character];

  useEffect(() => {
    callbacksRef.current = { onScaleChange, onScaleCommit, onTap };
  }, [onScaleChange, onScaleCommit, onTap]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const showBubble = useCallback((text: string, duration = BUBBLE_DURATION_MS) => {
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    setBubble(text);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubble(null);
      bubbleTimerRef.current = null;
    }, duration);
  }, []);

  const clearBubble = useCallback(() => {
    if (bubbleTimerRef.current) {
      window.clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
    setBubble(null);
  }, []);

  useEffect(
    () => () => {
      if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    },
    [],
  );

  // 缩放变化：直接改模型 scale，不重新加载模型。
  useEffect(() => {
    scaleRef.current = scale;
    const model = modelRef.current;
    const base = baseScaleRef.current;
    if (!model || !base) return;
    const next = base * (scale / 100);
    model.scale.set(next, next);
    refreshBoundsRef.current?.();
  }, [scale]);

  // 前后台切换时暂停 / 恢复渲染。
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    if (paused) app.ticker.stop();
    else app.ticker.start();
  }, [paused, status]);

  useEffect(() => {
    const stage = stageRef.current;
    const mount = mountRef.current;
    if (!stage || !mount) return;

    let cancelled = false;
    let app: Application | null = null;
    let model: Live2DModel | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let idleSpeechTimer: number | null = null;
    let idlePoseTimer: number | null = null;
    let expressionTimer: number | null = null;
    let greetingTimer: number | null = null;
    const fitTimers: number[] = [];
    let lastBoundsAt = 0;
    let targetX = 0;
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let gazeMode: "follow" | "idle" = "follow";
    let expressionMode: "none" | "idle-pose" | "click" = "none";
    let idleGazeState: IdleGazeState | null = null;
    let lastSoundAt = -1e9;
    let gestureScale = scaleRef.current;

    const pointers = new Map<number, Point>();
    let tapStart: {
      x: number;
      y: number;
      at: number;
      moved: boolean;
    } | null = null;
    let pinch: {
      startDistance: number;
      startScale: number;
    } | null = null;

    pointerLeftAtRef.current = performance.now();

    const updateCharacterBox = () => {
      if (!model) return;
      const rect = canvas.getBoundingClientRect();
      const bounds = model.getBounds();
      const nextBox: CharacterBox = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
      const previousBox = characterBoxRef.current;
      if (
        !previousBox ||
        Math.abs(previousBox.x - nextBox.x) > 1 ||
        Math.abs(previousBox.y - nextBox.y) > 1 ||
        Math.abs(previousBox.width - nextBox.width) > 1 ||
        Math.abs(previousBox.height - nextBox.height) > 1
      ) {
        characterBoxRef.current = nextBox;
      }

      const nextAnchor: BubbleAnchor = {
        x: clamp(
          rect.left + bounds.x + bounds.width / 2,
          150,
          Math.max(150, window.innerWidth - 150),
        ),
        y: Math.max(100, rect.top + bounds.y),
      };
      const previousAnchor = bubbleAnchorRef.current;
      if (
        !previousAnchor ||
        Math.abs(previousAnchor.x - nextAnchor.x) > 1 ||
        Math.abs(previousAnchor.y - nextAnchor.y) > 1
      ) {
        bubbleAnchorRef.current = nextAnchor;
        setBubbleAnchor(nextAnchor);
      }

      if (gazeMode === "follow") updateGaze();
    };

    const applyScale = () => {
      if (!model) return;
      const base = baseScaleRef.current;
      if (!base) return;
      const next = base * (scaleRef.current / 100);
      model.scale.set(next, next);
      updateCharacterBox();
    };

    const fitModel = () => {
      if (!model) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      const bounds = model.getLocalBounds();
      const modelWidth = Math.max(1, bounds.width || model.width);
      const modelHeight = Math.max(1, bounds.height || model.height);
      // 顶部给气泡留空间，底部避开手势条；人物仍占屏幕约八成高度。
      const topReserve = 140;
      const bottomReserve = 40;
      const availableHeight = Math.max(1, height - topReserve - bottomReserve);
      baseScaleRef.current =
        Math.min(width / modelWidth, availableHeight / modelHeight) * 0.98;
      model.anchor.set(0.5, 1);
      model.position.set(width / 2, height - 40);
      applyScale();
    };

    const updateGaze = () => {
      if (!model) return;
      const pointer = pointerRef.current;
      if (!pointer) return;
      const rect = canvas.getBoundingClientRect();
      const bounds = model.getBounds();
      const headX = rect.left + bounds.x + bounds.width / 2;
      const headY = rect.top + bounds.y + bounds.height * 0.12;
      targetX = clamp((pointer.x - headX) / (window.innerWidth * 0.5), -1, 1);
      targetY = clamp((pointer.y - headY) / (window.innerHeight * 0.5), -1, 1);
    };

    const scheduleIdleSpeech = () => {
      if (idleSpeechTimer) window.clearTimeout(idleSpeechTimer);
      idleSpeechTimer = window.setTimeout(() => {
        if (!cancelled && !pausedRef.current && !document.hidden) {
          showBubble(pick(LIVE2D_IDLE_LINES));
        }
        scheduleIdleSpeech();
      }, randomBetween(25000, 45000));
    };

    function startExpression(
      name: Live2DExpression,
      holdMs: number,
      mode: "idle-pose" | "click",
    ) {
      if (cancelled || !model) return;
      if (expressionTimer) {
        window.clearTimeout(expressionTimer);
        expressionTimer = null;
      }
      expressionMode = mode;
      void model.expression(name).catch((error: unknown) => {
        console.warn("[live2d] expression failed", error);
      });
      expressionTimer = window.setTimeout(() => {
        expressionTimer = null;
        if (cancelled) return;
        const manager = model?.internalModel.motionManager as unknown as {
          expressionManager?: { resetExpression: () => void };
        };
        manager.expressionManager?.resetExpression();
        expressionMode = "none";
        if (gazeMode === "idle") {
          scheduleIdlePose(
            LIVE2D_IDLE_POSE_REPEAT_MIN_MS,
            LIVE2D_IDLE_POSE_REPEAT_MAX_MS,
          );
        }
      }, holdMs);
    }

    function scheduleIdlePose(minimumMs: number, maximumMs: number) {
      if (idlePoseTimer) {
        window.clearTimeout(idlePoseTimer);
        idlePoseTimer = null;
      }
      if (cancelled || gazeMode !== "idle") return;
      const delay = randomBetween(minimumMs, maximumMs);
      idlePoseTimer = window.setTimeout(() => {
        idlePoseTimer = null;
        if (cancelled || gazeMode !== "idle") return;
        if (document.hidden || pausedRef.current) return;
        if (expressionMode !== "none") {
          scheduleIdlePose(
            LIVE2D_IDLE_POSE_RETRY_MIN_MS,
            LIVE2D_IDLE_POSE_RETRY_MAX_MS,
          );
          return;
        }
        const hold = randomBetween(
          LIVE2D_IDLE_POSE_HOLD_MIN_MS,
          LIVE2D_IDLE_POSE_HOLD_MAX_MS,
        );
        startExpression(characterProfile.idlePose, hold, "idle-pose");
      }, delay);
    }

    function enterIdle() {
      if (cancelled || gazeMode === "idle") return;
      gazeMode = "idle";
      const step = createIdleGaze(performance.now(), targetX, targetY);
      idleGazeState = step.state;
      targetX = step.x;
      targetY = step.y;
      scheduleIdlePose(
        LIVE2D_IDLE_POSE_FIRST_MIN_MS,
        LIVE2D_IDLE_POSE_FIRST_MAX_MS,
      );
    }

    function leaveIdle() {
      if (gazeMode === "follow") return;
      gazeMode = "follow";
      idleGazeState = null;
      if (idlePoseTimer) {
        window.clearTimeout(idlePoseTimer);
        idlePoseTimer = null;
      }
    }

    const noteInteraction = (x: number, y: number) => {
      pointerRef.current = { x, y };
      pointerLastAtRef.current = performance.now();
      if (gazeMode === "idle") leaveIdle();
      updateGaze();
    };

    const resetPointer = () => {
      pointerRef.current = null;
      pointerLeftAtRef.current = performance.now();
    };

    const playClickSound = () => {
      const sound = characterProfile.clickSound;
      if (!sound) return;
      const now = performance.now();
      if (!shouldPlayClickSound(sound, now, lastSoundAt, Math.random())) return;
      lastSoundAt = now;
      const audio = new Audio(sound.src);
      audio.volume = 0.75;
      void audio.play().catch(() => {
        // 部分 WebView 在静音 / 权限限制下会拒绝播放，忽略即可。
      });
    };

    const react = () => {
      if (cancelled || !model) return;
      if (idlePoseTimer) {
        window.clearTimeout(idlePoseTimer);
        idlePoseTimer = null;
      }
      const expression = pick(characterProfile.clickExpressions);
      showBubble(
        LIVE2D_EXPRESSION_LINES[expression] ?? pick(LIVE2D_TAP_LINES),
      );
      startExpression(expression, LIVE2D_CLICK_HOLD_MS, "click");
      playClickSound();
      callbacksRef.current.onTap?.();
      scheduleIdleSpeech();
    };

    const insideCharacter = (clientX: number, clientY: number) => {
      const box = characterBoxRef.current;
      if (!box) return false;
      const rect = canvas.getBoundingClientRect();
      const left = rect.left + box.x;
      const top = rect.top + box.y;
      return (
        clientX >= left &&
        clientX <= left + box.width &&
        clientY >= top &&
        clientY <= top + box.height
      );
    };

    const pointerDistance = () => {
      const values = [...pointers.values()];
      if (values.length < 2) return 0;
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {
        // best-effort
      }
      const point = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, point);
      noteInteraction(point.x, point.y);

      if (pointers.size === 1) {
        tapStart = {
          x: point.x,
          y: point.y,
          at: performance.now(),
          moved: false,
        };
        pinch = null;
      } else {
        tapStart = null;
        if (pointers.size === 2 && FEATURES.pinchZoom) {
          const distance = pointerDistance();
          if (distance >= PINCH_MIN_DISTANCE_PX) {
            pinch = {
              startDistance: distance,
              startScale: scaleRef.current,
            };
            gestureScale = scaleRef.current;
          }
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, point);
      }
      noteInteraction(point.x, point.y);

      if (tapStart) {
        const distance = Math.hypot(
          point.x - tapStart.x,
          point.y - tapStart.y,
        );
        if (distance > TAP_MAX_DISTANCE_PX) tapStart.moved = true;
      }

      if (pinch && pointers.size >= 2) {
        const distance = pointerDistance();
        if (distance >= PINCH_MIN_DISTANCE_PX) {
          const next = clampScale(
            (pinch.startScale * distance) / pinch.startDistance,
          );
          if (next !== gestureScale) {
            gestureScale = next;
            callbacksRef.current.onScaleChange(next);
          }
        }
      }
    };

    const finishPointer = (event: PointerEvent, allowTap: boolean) => {
      if (!pointers.has(event.pointerId)) return;
      const wasTap =
        allowTap &&
        !!tapStart &&
        !tapStart.moved &&
        performance.now() - tapStart.at <= TAP_MAX_DURATION_MS &&
        pointers.size === 1;

      if (pinch && pointers.size <= 2) {
        callbacksRef.current.onScaleCommit(gestureScale);
        pinch = null;
      }

      pointers.delete(event.pointerId);
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch {
        // best-effort
      }

      if (wasTap) {
        if (insideCharacter(event.clientX, event.clientY)) react();
        else clearBubble();
      }

      if (pointers.size === 0) {
        tapStart = null;
        pinch = null;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault();
      finishPointer(event, true);
    };

    const onPointerCancel = (event: PointerEvent) => {
      finishPointer(event, false);
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") resetPointer();
    };

    const onVisibilityChange = () => {
      if (!app) return;
      if (document.hidden || pausedRef.current) {
        app.ticker.stop();
        return;
      }
      app.ticker.start();
      if (
        gazeMode === "idle" &&
        !idlePoseTimer &&
        expressionMode === "none"
      ) {
        scheduleIdlePose(
          LIVE2D_IDLE_POSE_FIRST_MIN_MS,
          LIVE2D_IDLE_POSE_FIRST_MAX_MS,
        );
      }
    };

    const onWindowResize = () => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        fitModel();
        updateCharacterBox();
      });
    };

    let canvas!: HTMLCanvasElement;

    const start = async () => {
      setStatus("loading");
      try {
        await loadCubismCore();
        if (cancelled) return;

        const PIXI = await import("pixi.js");
        if (cancelled) return;
        const LIVE2D = await import("untitled-pixi-live2d-engine/cubism");
        if (cancelled) return;

        // Capacitor 的本地资源在 https://localhost/ 下，显式给 Pixi Resolver 根路径。
        const rendererRoot = `${window.location.origin}/`;
        if (PIXI.Assets?.resolver) {
          PIXI.Assets.resolver.basePath = rendererRoot;
          PIXI.Assets.resolver.rootPath = rendererRoot;
        }

        if (!pluginRegistered) {
          PIXI.extensions.add(LIVE2D.Live2DPlugin);
          pluginRegistered = true;
        }
        if (!cubismConfigured) {
          LIVE2D.configureCubismSDK({ memorySizeMB: 64 });
          cubismConfigured = true;
        }

        const pixiApp = new PIXI.Application();
        app = pixiApp;
        appRef.current = pixiApp;
        await pixiApp.init({
          resizeTo: mount,
          backgroundAlpha: 0,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: "webgl",
          antialias: false,
        });
        if (cancelled) {
          pixiApp.destroy(true);
          return;
        }

        canvas = pixiApp.canvas as HTMLCanvasElement;
        mount.appendChild(canvas);
        canvas.style.touchAction = "none";
        canvas.setAttribute("aria-hidden", "true");
        pixiApp.ticker.maxFPS = 30;

        const live2dModel = await LIVE2D.Live2DModel.from(
          characterProfile.modelPath,
          {
            autoFocus: false,
            autoHitTest: false,
            anchorMode: "drawable",
            // 手机显存有限：按实际屏幕尺寸生成贴图，避免 4096 全量驻留。
            textureOptions: { lod: "single-auto" },
          },
        );
        model = live2dModel;
        modelRef.current = live2dModel;
        if (cancelled) {
          live2dModel.destroy();
          pixiApp.destroy(true);
          return;
        }

        pixiApp.stage.addChild(live2dModel);
        fitModel();
        refreshBoundsRef.current = updateCharacterBox;
        updateCharacterBox();
        setStatus("ready");

        // 首次 addChild 后 Pixi 的 bounds 还没稳定（可能拿到双倍尺寸），
        // 等渲染几帧后再适配一次，避免人物只显示一半大。
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          fitModel();
          updateCharacterBox();
        });
        fitTimers.push(
          window.setTimeout(() => {
            if (!cancelled) fitModel();
          }, 120),
          window.setTimeout(() => {
            if (!cancelled) fitModel();
          }, 400),
        );

        const core = live2dModel.internalModel.coreModel as unknown as ParameterCore;
        const idHeadX = getParameterId(live2dModel, "Param85");
        const idHeadY = getParameterId(live2dModel, "Param86");
        const idHeadZ = getParameterId(live2dModel, "Param87");
        const idEyeX = getParameterId(live2dModel, "ParamEyeBallX");
        const idEyeY = getParameterId(live2dModel, "ParamEyeBallY");

        pixiApp.ticker.add((ticker) => {
          const now = performance.now();
          if (now - lastBoundsAt > BOUNDS_REFRESH_MS) {
            lastBoundsAt = now;
            updateCharacterBox();
          }

          if (gazeMode === "follow") {
            if (pointerRef.current) {
              if (now - pointerLastAtRef.current > LIVE2D_IDLE_STILL_MS) {
                enterIdle();
              }
            } else if (now - pointerLeftAtRef.current > LIVE2D_IDLE_LEAVE_MS) {
              enterIdle();
            }
          } else if (
            gazeMode === "idle" &&
            pointerRef.current &&
            now - pointerLastAtRef.current < 500
          ) {
            leaveIdle();
            updateGaze();
          }

          if (gazeMode === "idle" && idleGazeState) {
            const step = advanceIdleGaze(idleGazeState, now);
            idleGazeState = step.state;
            targetX = step.x;
            targetY = step.y;
          }

          const delta = Math.min(ticker.deltaMS, 50);
          const ease = 1 - Math.exp(-delta / 140);
          smoothX += (targetX - smoothX) * ease;
          smoothY += (targetY - smoothY) * ease;
          core.setParameterValueById(idHeadX, smoothX * 28);
          core.setParameterValueById(idHeadY, smoothY * -24);
          core.setParameterValueById(idHeadZ, smoothX * 6);
          core.setParameterValueById(idEyeX, smoothX * 0.8);
          core.setParameterValueById(idEyeY, smoothY * -0.8);
        });

        if (pausedRef.current) pixiApp.ticker.stop();

        stage.addEventListener("pointerdown", onPointerDown, { passive: false });
        stage.addEventListener("pointermove", onPointerMove, { passive: false });
        stage.addEventListener("pointerup", onPointerUp, { passive: false });
        stage.addEventListener("pointercancel", onPointerCancel, {
          passive: false,
        });
        stage.addEventListener("pointerleave", onPointerLeave);
        window.addEventListener("blur", resetPointer);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("resize", onWindowResize);

        resizeObserver = new ResizeObserver(() => {
          if (cancelled) return;
          fitModel();
          updateCharacterBox();
        });
        resizeObserver.observe(mount);

        greetingTimer = window.setTimeout(() => {
          if (cancelled || pausedRef.current) return;
          showBubble(pick(LIVE2D_GREETINGS));
          scheduleIdleSpeech();
        }, GREETING_DELAY_MS);
      } catch (error) {
        if (cancelled) return;
        console.warn("[live2d] load failed", error);
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (idleSpeechTimer) window.clearTimeout(idleSpeechTimer);
      if (idlePoseTimer) window.clearTimeout(idlePoseTimer);
      if (expressionTimer) window.clearTimeout(expressionTimer);
      if (greetingTimer) window.clearTimeout(greetingTimer);
      for (const timer of fitTimers) window.clearTimeout(timer);
      resizeObserver?.disconnect();
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerCancel);
      stage.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onWindowResize);
      refreshBoundsRef.current = null;
      modelRef.current = null;
      baseScaleRef.current = 0;
      characterBoxRef.current = null;
      bubbleAnchorRef.current = null;
      if (model) safeDestroy(() => model?.destroy());
      if (app) safeDestroy(() => app?.destroy(true));
      appRef.current = null;
      model = null;
      app = null;
    };
  }, [character, characterProfile, retryToken, showBubble, clearBubble]);

  const retry = () => {
    setStatus("loading");
    setRetryToken((value) => value + 1);
  };

  return (
    <div className={styles.root} data-character={character}>
      <div
        ref={stageRef}
        className={styles.stage}
        aria-label={`和${characterProfile.name}互动`}
      >
        <div ref={mountRef} className={styles.canvasHost} />
      </div>

      {status === "loading" ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.loadingCard}>
            <span className={styles.loadingTitle}>
              {characterProfile.name}回溯中……
            </span>
            <span className={styles.loadingBar} aria-hidden="true" />
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className={styles.error} role="alert">
          <div className={styles.errorCard}>
            <span>{characterProfile.name}加载失败</span>
            <button type="button" className={styles.retryButton} onClick={retry}>
              重试
            </button>
          </div>
        </div>
      ) : null}

      {bubble && bubbleAnchor ? (
        <p
          className={styles.bubble}
          role="status"
          aria-live="polite"
          style={{ left: bubbleAnchor.x, top: bubbleAnchor.y }}
        >
          {bubble}
        </p>
      ) : null}
    </div>
  );
}
