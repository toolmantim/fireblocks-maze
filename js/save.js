const KEY = 'firebox-maze-save-v1';

const DEFAULTS = { v: 1, unlocked: 1, level: 1, color: '#ff3b30', weapon: 'blaster', armor: 'speedy', rescued: 0, muted: false, started: false };

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* private mode etc. */ }
  return { ...DEFAULTS };
}

export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
