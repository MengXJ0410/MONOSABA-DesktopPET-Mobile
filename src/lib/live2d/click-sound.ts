/**
 * 点击彩蛋的触发规则：先看冷却，再掷概率。
 * 拆成纯函数，方便后续做单元测试。
 */
export type ClickSoundRule = {
  chance: number;
  cooldownMs: number;
};

export function shouldPlayClickSound(
  rule: ClickSoundRule,
  now: number,
  lastPlayedAt: number,
  random: number,
): boolean {
  if (now - lastPlayedAt < rule.cooldownMs) return false;
  return random < rule.chance;
}
