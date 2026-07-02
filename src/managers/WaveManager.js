import * as THREE from 'three';

// Wave definitions: each wave is an array of {type, count} groups.
const WAVES = [
  // Onda 1-2: tutorial suave — poucas barcaças lentas
  [{ type: 'barge',   count: 2 }],
  [{ type: 'barge',   count: 3 }],
  // Onda 3-5: aumenta pressão
  [{ type: 'barge',   count: 4 }, { type: 'frigate', count: 1 }],
  [{ type: 'frigate', count: 3 }],
  [{ type: 'frigate', count: 4 }, { type: 'barge',   count: 2 }],
  // Onda 6-9: galeões entram
  [{ type: 'frigate', count: 4 }, { type: 'galleon', count: 1 }],
  [{ type: 'galleon', count: 3 }],
  [{ type: 'galleon', count: 3 }, { type: 'frigate', count: 3 }],
  [{ type: 'galleon', count: 4 }, { type: 'frigate', count: 4 }],
  // Onda 10: boss
  [{ type: 'ghost',   count: 1 }, { type: 'galleon', count: 3 }, { type: 'frigate', count: 4 }],
];

const WIND_DIRS = ['N', 'S', 'E', 'W'];
const WIND_VECS = {
  N: new THREE.Vector3(0, 0, -1),
  S: new THREE.Vector3(0, 0,  1),
  E: new THREE.Vector3( 1, 0, 0),
  W: new THREE.Vector3(-1, 0, 0),
};

export class WaveManager {
  constructor(path, eventBus) {
    this.path         = path;
    this.bus          = eventBus;
    this.currentWave  = 0;
    this.totalWaves   = WAVES.length;
    this.windDir      = 'N';
    this.windVector   = WIND_VECS['N'].clone();
    this._queue       = [];   // remaining spawns in current wave
    this._spawnTimer  = 0;
    this._spawnInterval = 1.5; // seconds between individual ship spawns
    this._active      = false;
    this._aliveCount  = 0;
    this._pendingSpawn = 0;
    this._hpScale     = 1;
  }

  startNextWave() {
    this.currentWave++;

    // Roll wind
    this.windDir    = WIND_DIRS[Math.floor(Math.random() * 4)];
    this.windVector = WIND_VECS[this.windDir].clone();
    this.bus.emit('wind-changed', { dir: this.windDir });

    // Scripted waves 1..N, then procedural endless waves that keep scaling up
    const groups = this.currentWave <= WAVES.length
      ? WAVES[this.currentWave - 1]
      : this._endlessWave(this.currentWave);

    // Endless waves also toughen ships (more HP the further you go)
    const over = Math.max(0, this.currentWave - WAVES.length);
    this._hpScale = 1 + over * 0.35;

    // Build spawn queue
    this._queue = [];
    for (const { type, count } of groups) {
      for (let i = 0; i < count; i++) this._queue.push(type);
    }
    this._aliveCount   = this._queue.length;
    this._pendingSpawn = this._queue.length;
    this._spawnTimer   = 0;
    this._active       = true;

    this.bus.emit('wave-started', { wave: this.currentWave, wind: this.windDir });
  }

  // Procedural wave for endless mode — grows in count and adds tougher ships
  _endlessWave(wave) {
    const over = wave - WAVES.length;   // 1, 2, 3, ...
    const groups = [
      { type: 'galleon', count: 3 + over },
      { type: 'frigate', count: 4 + over },
      { type: 'barge',   count: 2 + Math.floor(over / 2) },
    ];
    if (over >= 2) groups.push({ type: 'ghost', count: Math.floor(over / 2) });
    return groups;
  }

  onEnemyDied()         { this._aliveCount--; this._checkWaveDone(); }
  onEnemyReachedPort()  { this._aliveCount--; this._checkWaveDone(); }

  _checkWaveDone() {
    if (this._active && this._pendingSpawn === 0 && this._aliveCount <= 0) {
      this._active = false;
      this.bus.emit('wave-complete', { wave: this.currentWave });
    }
  }

  update(delta) {
    if (!this._active || this._queue.length === 0) return;
    this._spawnTimer -= delta;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = this._spawnInterval;
      const type = this._queue.shift();
      this._pendingSpawn--;
      this.bus.emit('spawn-enemy', { type, hpScale: this._hpScale });
    }
  }

  reset() {
    this.currentWave   = 0;
    this._queue        = [];
    this._active       = false;
    this._aliveCount   = 0;
    this._pendingSpawn = 0;
    this._hpScale      = 1;
    this.windDir       = 'N';
    this.windVector    = WIND_VECS['N'].clone();
  }
}
