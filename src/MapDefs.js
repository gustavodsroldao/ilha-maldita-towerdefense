// Map definitions — all coordinates are [x, z] pairs; Y is derived automatically.
// path: enemy waypoints from spawn to port
// slots: tower placement positions on the island surface
// island: geometry configuration per type

export const MAP_DEFS = {
  'ilha-maldita': {
    id: 'ilha-maldita',
    name: 'Ilha Maldita',
    subtitle: 'Caminho circular clássico',
    difficulty: 2,
    startGold: 200,
    spawnInterval: 1.5,
    enemySpeedMult: 1.0,
    waveBonusBase: 60,
    path: [
      [-32,  2], [-24,-12], [-14,-23], [0,-26], [14,-23],
      [24,-10], [24, 6], [16, 21], [2, 25], [-10, 21], [-18, 10], [-23, 2],
    ],
    slots: [
      [-8,-10], [0,-13], [8,-10], [13,-2], [11,9],
      [3,13], [-4,13], [-11,5], [-7,-2], [0,1],
    ],
    island: { type: 'standard', rx: 12, rz: 12 },
    portPos: [-16, 0.3, 2],
    camOffset: [0, 35, 28],
  },

  'serpente': {
    id: 'serpente',
    name: 'Serpente do Mar',
    subtitle: 'Canal sinuoso de alta dificuldade',
    difficulty: 3,
    startGold: 175,
    spawnInterval: 1.1,
    enemySpeedMult: 1.25,
    waveBonusBase: 80,
    path: [
      [-28, 16], [-20, 8], [-10, 4], [0, 0], [8,-6], [14,-16],
      [6,-24], [-4,-26], [-14,-18], [-22,-6], [-26, 4],
    ],
    slots: [
      [-15, 10], [-4, 8], [6, 2], [12,-8], [8,-20],
      [-2,-24], [-14,-14], [-24,-2],
    ],
    island: { type: 'elongated', rx: 9, rz: 9, scaleZ: 1.9 },
    portPos: [-22, 0.3, 4],
    camOffset: [0, 35, 28],
  },

  'arquipelago': {
    id: 'arquipelago',
    name: 'Arquipélago',
    subtitle: 'Duas ilhas — mais espaço, menos ouro',
    difficulty: 1,
    startGold: 250,
    spawnInterval: 1.9,
    enemySpeedMult: 0.82,
    waveBonusBase: 45,
    path: [
      [28, 4], [20,-8], [12,-16], [4,-16], [-4,-10],
      [-12,-4], [-18, 4], [-16, 12], [-8, 16], [0, 14],
      [8, 10], [14, 4], [12,-4], [4, 0], [-2, 6],
      [-10, 8], [-20, 4],
    ],
    slots: [
      [14,-14], [6,-14], [-2,-8], [-10,-2], [-16, 6],
      [-14, 14], [-6, 16], [2, 12], [10, 8], [16, 0],
      [10,-10], [0, 0],
    ],
    island: { type: 'twin' },
    portPos: [-16, 0.3, 4],
    camOffset: [0, 38, 32],
  },
};

// Difficulty display helpers
export const DIFF_LABELS  = ['', 'Fácil', 'Médio', 'Difícil'];
export const DIFF_COLORS  = ['', '#44ee44', '#ffaa22', '#ff4444'];
export const DIFF_STARS   = ['', '★☆☆', '★★☆', '★★★'];
