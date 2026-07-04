import { LEVELS, T_FLOOR, T_WALL, T_BREAK, T_BAR, T_DOOR } from './config.js';

// deterministic rng so each level's maze is always the same
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genMaze(levelNum) {
  const cfg = LEVELS[levelNum - 1];
  const rnd = mulberry32(levelNum * 7919 + 1234);
  const c = cfg.cells;
  const n = 2 * c + 1;
  const t = new Uint8Array(n * n).fill(T_WALL);
  const at = (x, z) => z * n + x;

  // recursive backtracker over cells
  const visited = new Uint8Array(c * c);
  const stack = [[0, 0]];
  visited[0] = 1;
  t[at(1, 1)] = T_FLOOR;
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const opts = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx >= 0 && nx < c && nz >= 0 && nz < c && !visited[nz * c + nx]) opts.push([dx, dz]);
    }
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dz] = opts[(rnd() * opts.length) | 0];
    const nx = cx + dx, nz = cz + dz;
    visited[nz * c + nx] = 1;
    t[at(2 * nx + 1, 2 * nz + 1)] = T_FLOOR;
    t[at(2 * cx + 1 + dx, 2 * cz + 1 + dz)] = T_FLOOR;
    stack.push([nx, nz]);
  }

  // center room 5x5 with a 3x3 jail ring inside
  const mid = Math.floor(n / 2);
  for (let z = mid - 2; z <= mid + 2; z++)
    for (let x = mid - 2; x <= mid + 2; x++) t[at(x, z)] = T_FLOOR;
  for (let z = mid - 1; z <= mid + 1; z++)
    for (let x = mid - 1; x <= mid + 1; x++)
      if (x !== mid || z !== mid) t[at(x, z)] = T_BAR;
  t[at(mid, mid + 1)] = T_DOOR; // jail gate on the south side

  // punch openings from the room out to the corridors (walk outward until floor)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let x = mid + dx * 3, z = mid + dz * 3;
    while (x > 0 && x < n - 1 && z > 0 && z < n - 1 && t[at(x, z)] !== T_FLOOR) {
      t[at(x, z)] = T_FLOOR;
      x += dx; z += dz;
    }
  }

  // helper: wall separating two floors (loop/shortcut candidates)
  const shortcutWalls = [];
  for (let z = 1; z < n - 1; z++)
    for (let x = 1; x < n - 1; x++) {
      if (t[at(x, z)] !== T_WALL) continue;
      const roomNear = Math.abs(x - mid) <= 3 && Math.abs(z - mid) <= 3;
      if (roomNear) continue;
      if ((t[at(x - 1, z)] === T_FLOOR && t[at(x + 1, z)] === T_FLOOR) ||
          (t[at(x, z - 1)] === T_FLOOR && t[at(x, z + 1)] === T_FLOOR)) shortcutWalls.push([x, z]);
    }
  // some become open loops, some become drillable cracked blocks
  const shuffled = shortcutWalls.sort(() => rnd() - 0.5);
  const loops = Math.min(levelNum + 1, shuffled.length);
  for (let i = 0; i < loops; i++) { const [x, z] = shuffled[i]; t[at(x, z)] = T_FLOOR; }
  const breaks = [];
  for (let i = loops; i < Math.min(loops + cfg.breaks, shuffled.length); i++) {
    const [x, z] = shuffled[i]; t[at(x, z)] = T_BREAK; breaks.push([x, z]);
  }

  const spawn = [1, n - 2]; // bottom-left, so the maze opens up-screen (north)
  const exit = [n - 2, 1];  // top-right

  // fire tiles: on floor, away from spawn/exit/room, never adjacent to another fire
  const fires = [];
  const isFireOk = (x, z) => {
    if (t[at(x, z)] !== T_FLOOR) return false;
    if (Math.abs(x - mid) <= 3 && Math.abs(z - mid) <= 3) return false;
    if (Math.hypot(x - spawn[0], z - spawn[1]) < 5) return false;
    if (Math.hypot(x - exit[0], z - exit[1]) < 3) return false;
    return fires.every(([fx, fz]) => Math.abs(fx - x) + Math.abs(fz - z) > 2);
  };
  let tries = 0;
  while (fires.length < cfg.fires && tries++ < 600) {
    const x = 1 + ((rnd() * (n - 2)) | 0), z = 1 + ((rnd() * (n - 2)) | 0);
    if (isFireOk(x, z)) fires.push([x, z]);
  }

  // guard patrol corners (room floor ring)
  const guardPath = [[mid - 2, mid - 2], [mid + 2, mid - 2], [mid + 2, mid + 2], [mid - 2, mid + 2]];

  return { n, t, at, spawn, exit, mid, fires, breaks, guardPath, cfg, seedRnd: rnd };
}
