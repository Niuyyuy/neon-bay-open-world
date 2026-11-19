// Neon Bay — every tuning number, colour and story beat in one place.
// The city is a grid: roads run every ROAD_STEP units, blocks sit between
// them, and the bay washes the whole western edge.
export const CITY = {
  roadStep: 52,
  roads: 9, // roads at -208, -156, ..., 208
  roadWidth: 12,
  laneOffset: 3,
  blockSize: 34,
  groundY: 0,
};

export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 9,
  sprintSpeed: 14,
  radius: 0.9,
  height: 1.8,
  maxHealth: 100,
  turnSpeed: 10,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,
  maxReverse: 10,
  steerMax: 0.55,
  grip: 6,
  length: 4.4,
  width: 2.0,
  health: 100,
};

export const TRAFFIC = { count: 14, speed: 11, minGap: 9 };
export const PEDESTRIANS = { count: 24, speed: 1.6 };

export const WANTED = {
  decaySeconds: 22,
  maxStars: 5,
  policeCars: [0, 1, 1, 2, 3, 4],
  policeOnFoot: [0, 0, 1, 2, 3, 4],
};

export const PALETTE = {
  sky: 0x87b5e0,
  sun: 0xfff2d8,
  fog: 0xa8c8e8,
  ground: 0x3d4a3a,
  sidewalk: 0x9aa0a6,
  asphalt: 0x2b2e33,
  lineWhite: 0xe8e8e8,
  lineYellow: 0xf2c94c,
  downtown: [0x5b7fa6, 0x7fa6c9, 0x4a6b8a, 0x8fb3d9, 0x6b8cae],
  harbor: [0x7a6a58, 0x8a7a68, 0x6a7a8a, 0x9a8a72],
  oldTown: [0x9a6a4a, 0x8a5a3a, 0xa67a52, 0x7a4a3a],
  palmRow: [0xd9c9a8, 0xc9b89a, 0xe8dcc0, 0xb8a888],
  carColors: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085],
  police: 0x1a2a4a,
  policeLight: 0xff2222,
  player: 0x2ecc71,
};

export const DISTRICTS = [
  { name: 'Downtown', quadrant: 'NE', minH: 22, maxH: 48, palette: 'downtown' },
  { name: 'Harbor', quadrant: 'NW', minH: 8, maxH: 16, palette: 'harbor' },
  { name: 'Old Town', quadrant: 'SW', minH: 10, maxH: 22, palette: 'oldTown' },
  { name: 'Palm Row', quadrant: 'SE', minH: 6, maxH: 12, palette: 'palmRow' },
  // Marina: the far-west strip by the water, south of the Harbor docks.
  // No city blocks sit out there — only the Marina garage — so its
  // heights are nominal; it exists so the garage reads as Marina.
  { name: 'Marina', quadrant: 'W', minH: 6, maxH: 10, palette: 'harbor' },
];

// The story: Rio Vale, a wheelman fresh out of prison, works off a debt to
// Mara Solano, who runs the Neon Bay docks. Four jobs, four payouts.
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Mission 1 — The Pickup',
    brief: 'Mara needs a car. Steal the red coupe parked by the Harbor docks and bring it to the Marina garage.',
    dialogue: [
      ['Mara Solano', 'Rio. You owe me three years. One car, one garage, and we call it even for today.'],
      ['Rio Vale', 'One car. I can do one car.'],
    ],
    objectives: [
      { kind: 'steal', text: 'Steal the red coupe by the Harbor docks', target: { x: -218, z: -26 } },
      { kind: 'deliver', text: 'Deliver it to the Marina garage', target: { x: -208, z: 130 } },
    ],
    reward: 500,
  },
  {
    id: 'hot-pursuit',
    title: 'Mission 2 — Hot Pursuit',
    brief: 'A package for the Palm Row club, and the police are already on you. Lose them and deliver it in time.',
    dialogue: [
      ['Mara Solano', 'Package in the glovebox. The Bay PD has the route staked out. Do not stop.'],
      ['Rio Vale', 'Then I will not stop.'],
    ],
    objectives: [
      { kind: 'drive', text: 'Reach the Palm Row club before time runs out', target: { x: 182, z: 182 }, timeLimit: 90 },
    ],
    reward: 750,
    wantedOnStart: 3,
  },
  {
    id: 'package-run',
    title: 'Mission 3 — Package Run',
    brief: 'Five drops across Neon Bay. Collect them all, on foot or by car, and stay out of trouble.',
    dialogue: [
      ['Mara Solano', 'Five drops, five corners of my city. Pick them up, no questions, no sirens.'],
    ],
    objectives: [
      { kind: 'collect', text: 'Collect 5 packages around the city', count: 5 },
    ],
    reward: 1000,
  },
  {
    id: 'last-score',
    title: 'Mission 4 — The Last Score',
    brief: 'The Bay Trust vault. Get in, grab the cash, and get out. The whole city will be after you.',
    dialogue: [
      ['Mara Solano', 'The vault, Rio. One job and your debt is gone. The guards will not just watch.'],
      ['Rio Vale', 'Then I had better be faster than them.'],
    ],
    objectives: [
      { kind: 'rob', text: 'Storm the Bay Trust vault in Downtown and grab the cash', target: { x: 130, z: -130 } },
      { kind: 'escape', text: 'Escape to the safehouse in Palm Row with 4 stars on you', target: { x: 182, z: 182 } },
    ],
    reward: 2500,
    wantedOnStart: 1,
  },
];

export const SAVE_KEY = 'neon-bay.save.v1';
export const BEST_KEY = 'neon-bay.best.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const TITLE_FONT = '"Arial Black", system-ui, sans-serif';
export const GAME_TITLE = 'Neon Bay';
export const STORY = {
  intro: 'Rio Vale is out of prison and owes Mara Solano of the Neon Bay docks a fortune. Four jobs stand between Rio and freedom — take a car, any car, and work off the debt.',
};
