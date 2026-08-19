// A guild's wealth is stored as a single silver-denominated integer
// (guild.tokens). Gold is a display convention on top of it, not a
// separate stored value - 100 silver renders as "1 gold" (mirrors
// GOLD_TO_SILVER in server/src/config.ts).
const GOLD_TO_SILVER = 100;

export function formatCoins(silver: number): string {
  const gold = Math.floor(silver / GOLD_TO_SILVER);
  const rest = silver % GOLD_TO_SILVER;
  if (gold === 0) return `🪙${rest}`;
  return `🥇${gold} 🪙${rest}`;
}
