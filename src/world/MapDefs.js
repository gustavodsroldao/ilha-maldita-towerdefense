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
    // Elongated island fills the middle — enemies loop around it through the
    // water (down the right side, across the bottom, up the left to the port).
    path: [
      [16, 22], [17, 8], [17, -8], [12, -22], [0, -25],
      [-13, -20], [-19, -6], [-22, 4],
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
    // Twin islands nearly touch (bridge between them) — no water channel in the
    // middle, so enemies loop around the OUTSIDE of both islands to the port.
    path: [
      [30, 6], [26, -6], [19, -16], [9, -22], [-3, -22],
      [-15, -18], [-24, -9], [-29, 1], [-27, 11], [-21, 12],
      [-21, 4],
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

  'recife-caveira': {
    id: 'recife-caveira',
    name: 'Recife da Caveira',
    subtitle: 'Contorno traiçoeiro rumo a leste',
    difficulty: 2,
    startGold: 190,
    spawnInterval: 1.4,
    enemySpeedMult: 1.05,
    waveBonusBase: 60,
    path: [
      [-30, 2], [-24, -14], [-8, -22], [10, -22], [22, -14], [27, 0], [22, 2],
    ],
    slots: [
      [-8, -8], [2, -11], [11, -6], [13, 3], [6, 12],
      [-4, 12], [-12, 4], [-6, -2], [3, 2], [10, 9],
    ],
    island: { type: 'standard', rx: 12, rz: 12 },
    portPos: [22, 0.3, 2],
    camOffset: [0, 36, 30],
  },

  'serpente-negra': {
    id: 'serpente-negra',
    name: 'Serpente Negra',
    subtitle: 'O canal sinuoso ao contrário — brutal',
    difficulty: 3,
    startGold: 170,
    spawnInterval: 1.05,
    enemySpeedMult: 1.3,
    waveBonusBase: 85,
    path: [
      [-16, 22], [-17, 8], [-17, -8], [-12, -22], [0, -25], [13, -20], [19, -6], [22, 4],
    ],
    slots: [
      [15, 10], [4, 8], [-6, 2], [-12, -8], [-8, -20],
      [2, -24], [14, -14], [24, -2],
    ],
    island: { type: 'elongated', rx: 9, rz: 9, scaleZ: 1.9 },
    portPos: [22, 0.3, 4],
    camOffset: [0, 35, 28],
  },

  'atol-duplo': {
    id: 'atol-duplo',
    name: 'Atol Duplo',
    subtitle: 'Ilhas gêmeas — cerco pelo lado leste',
    difficulty: 2,
    startGold: 220,
    spawnInterval: 1.7,
    enemySpeedMult: 0.9,
    waveBonusBase: 55,
    path: [
      [-30, 6], [-26, -6], [-19, -16], [-9, -22], [3, -22],
      [15, -18], [24, -9], [29, 1], [27, 11], [21, 12], [21, 4],
    ],
    slots: [
      [-14, -14], [-6, -14], [2, -8], [10, -2], [16, 6], [14, 14],
      [6, 16], [-2, 12], [-10, 8], [-16, 0], [-10, -10], [0, 0],
    ],
    island: { type: 'twin' },
    portPos: [21, 0.3, 4],
    camOffset: [0, 38, 32],
  },

  'boca-kraken': {
    id: 'boca-kraken',
    name: 'Boca do Kraken',
    subtitle: 'Volta apertada até o porto ao sul',
    difficulty: 3,
    startGold: 165,
    spawnInterval: 1.0,
    enemySpeedMult: 1.35,
    waveBonusBase: 90,
    path: [
      [-28, -8], [-14, -20], [4, -24], [20, -18], [27, -2], [22, 14], [4, 22], [0, 20],
    ],
    slots: [
      [-9, -9], [0, -12], [9, -9], [12, 0], [9, 10],
      [0, 13], [-9, 10], [-12, 0], [0, 0], [6, 4],
    ],
    island: { type: 'standard', rx: 12, rz: 12 },
    portPos: [0, 0.3, 20],
    camOffset: [0, 36, 30],
  },

  'ilha-tesouro': {
    id: 'ilha-tesouro',
    name: 'Ilha do Tesouro',
    subtitle: 'Águas calmas, cofres cheios',
    difficulty: 1,
    startGold: 260,
    spawnInterval: 1.9,
    enemySpeedMult: 0.8,
    waveBonusBase: 45,
    path: [
      [24, 8], [26, -6], [14, -20], [-4, -22], [-20, -14], [-27, 2], [-20, 0],
    ],
    slots: [
      [-6, -9], [4, -11], [11, -4], [12, 5], [4, 12],
      [-6, 11], [-12, 2], [0, 0], [7, 3], [-3, -3],
    ],
    island: { type: 'standard', rx: 12, rz: 12 },
    portPos: [-20, 0.3, 0],
    camOffset: [0, 36, 30],
  },
};

// Difficulty display helpers
export const DIFF_LABELS  = ['', 'Fácil', 'Médio', 'Difícil'];
export const DIFF_COLORS  = ['', '#44ee44', '#ffaa22', '#ff4444'];
export const DIFF_STARS   = ['', '★☆☆', '★★☆', '★★★'];
