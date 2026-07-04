// All game tuning lives here.
export const TS = 2; // world units per maze tile

// 10 levels: maze size in cells, hazards, monsters
export const LEVELS = [
  { cells: 5,  fires: 2,  breaks: 4,  zombies: 0, creepers: 0 },
  { cells: 6,  fires: 3,  breaks: 5,  zombies: 0, creepers: 0 },
  { cells: 7,  fires: 5,  breaks: 6,  zombies: 0, creepers: 0 },
  { cells: 8,  fires: 6,  breaks: 7,  zombies: 1, creepers: 0 },
  { cells: 9,  fires: 8,  breaks: 8,  zombies: 2, creepers: 0 },
  { cells: 10, fires: 10, breaks: 9,  zombies: 3, creepers: 0 },
  { cells: 11, fires: 12, breaks: 10, zombies: 4, creepers: 0 },
  { cells: 12, fires: 14, breaks: 11, zombies: 5, creepers: 0 },
  { cells: 13, fires: 17, breaks: 12, zombies: 6, creepers: 0 },
  { cells: 15, fires: 24, breaks: 14, zombies: 9, creepers: 1 }, // level 10: SO hard
];

export const WEAPONS = {
  blaster: { name: 'Blaster',      emoji: '⚡', speed: 16, cd: 0.28, dmg: 1,   color: 0xffdd33 },
  water:   { name: 'Water Cannon', emoji: '💧', speed: 14, cd: 0.22, dmg: 0.5, color: 0x44bbff, douse: true, stun: 1.6 },
  boom:    { name: 'Boom Cannon',  emoji: '💥', speed: 9,  cd: 0.95, dmg: 3,   color: 0xff7733, blast: 2.4 },
};

export const ARMORS = {
  speedy: { name: 'Speedy Suit',  emoji: '🏎️', speed: 7.5, protect: 1,    fireproof: false },
  knight: { name: 'Knight Armor', emoji: '🛡️', speed: 6.3, protect: 0.5,  fireproof: false },
  tank:   { name: 'Mega Tank',    emoji: '🦾', speed: 5.4, protect: 0.25, fireproof: true },
};

export const COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#bf5af2', '#ff2d92'];

export const MAX_HP = 6;              // hearts
export const ZOMBIE_SPEED = 3.6;      // always slower than slowest armor (5.4)
export const CREEPER_SPEED = 4.6;
export const GUARD_SPEED = 2.2;
export const PEOPLE_PER_JAIL = 3;

// tile types in the grid
export const T_FLOOR = 0, T_WALL = 1, T_BREAK = 2, T_BAR = 3, T_DOOR = 4;
