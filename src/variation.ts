export type Mode = 'boss' | 'explorer';
const key = 'starville-variations-v1';
const memory: Record<Mode, number> = { boss: 0, explorer: 0 };
export function nextVariation(mode: Mode) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const value = saved[mode];
    return Number.isInteger(value) && value >= 0 && value < 3 ? value : memory[mode];
  } catch { return memory[mode]; }
}
export function advanceVariation(mode: Mode, completed: number) {
  memory[mode] = (completed + 1) % 3;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...saved, [mode]: memory[mode] }));
  } catch { /* Private browsing still cycles for this page session. */ }
}
