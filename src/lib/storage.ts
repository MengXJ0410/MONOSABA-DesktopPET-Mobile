import {
  LIVE2D_CHARACTER_STORAGE_KEY,
  LIVE2D_DEFAULT_CHARACTER,
  LIVE2D_ROTATE_DEFAULT_MAX_SECONDS,
  LIVE2D_ROTATE_DEFAULT_MIN_SECONDS,
  LIVE2D_ROTATE_MAX_SECONDS,
  LIVE2D_ROTATE_MIN_SECONDS,
  LIVE2D_ROTATE_STORAGE_KEY,
  LIVE2D_SCALE_STORAGE_KEY,
  LIVE2D_SIZE_DEFAULT,
  LIVE2D_SIZE_MAX,
  LIVE2D_SIZE_MIN,
  type Live2DCharacterId,
  type Live2DRotateSettings,
} from "@/content/live2d";

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampScale(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return LIVE2D_SIZE_DEFAULT;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return LIVE2D_SIZE_DEFAULT;
  return clamp(Math.round(numeric), LIVE2D_SIZE_MIN, LIVE2D_SIZE_MAX);
}

export function clampRotateSeconds(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(
    Math.round(numeric),
    LIVE2D_ROTATE_MIN_SECONDS,
    LIVE2D_ROTATE_MAX_SECONDS,
  );
}

export function readCharacter(): Live2DCharacterId {
  try {
    const raw = window.localStorage.getItem(LIVE2D_CHARACTER_STORAGE_KEY);
    return raw === "ema" ? "ema" : LIVE2D_DEFAULT_CHARACTER;
  } catch {
    return LIVE2D_DEFAULT_CHARACTER;
  }
}

export function persistCharacter(character: Live2DCharacterId): void {
  try {
    window.localStorage.setItem(LIVE2D_CHARACTER_STORAGE_KEY, character);
  } catch {
    // 隐私模式或存储被禁用时忽略。
  }
}

export function readScale(): number {
  try {
    return clampScale(window.localStorage.getItem(LIVE2D_SCALE_STORAGE_KEY));
  } catch {
    return LIVE2D_SIZE_DEFAULT;
  }
}

export function persistScale(scale: number): void {
  try {
    window.localStorage.setItem(
      LIVE2D_SCALE_STORAGE_KEY,
      String(clampScale(scale)),
    );
  } catch {
    // ignore
  }
}

export function readRotate(): Live2DRotateSettings {
  const fallback: Live2DRotateSettings = {
    enabled: false,
    minSeconds: LIVE2D_ROTATE_DEFAULT_MIN_SECONDS,
    maxSeconds: LIVE2D_ROTATE_DEFAULT_MAX_SECONDS,
  };
  try {
    const raw = window.localStorage.getItem(LIVE2D_ROTATE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Live2DRotateSettings>;
    const minSeconds = clampRotateSeconds(
      parsed.minSeconds,
      fallback.minSeconds,
    );
    const maxSeconds = Math.max(
      minSeconds,
      clampRotateSeconds(parsed.maxSeconds, fallback.maxSeconds),
    );
    return {
      enabled: parsed.enabled === true,
      minSeconds,
      maxSeconds,
    };
  } catch {
    return fallback;
  }
}

export function persistRotate(settings: Live2DRotateSettings): void {
  try {
    window.localStorage.setItem(
      LIVE2D_ROTATE_STORAGE_KEY,
      JSON.stringify({
        enabled: settings.enabled,
        minSeconds: clampRotateSeconds(settings.minSeconds, LIVE2D_ROTATE_DEFAULT_MIN_SECONDS),
        maxSeconds: clampRotateSeconds(settings.maxSeconds, LIVE2D_ROTATE_DEFAULT_MAX_SECONDS),
      }),
    );
  } catch {
    // ignore
  }
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

export function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * Math.max(0, maximum - minimum);
}
