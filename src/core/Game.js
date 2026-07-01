import * as THREE from 'three';
import { EventBus }       from './EventBus.js';
import { AssetLoader }    from './AssetLoader.js';
import { Scene }          from './Scene.js';
import { GameMap }        from './Map.js';
import { Enemy }          from './Enemy.js';
import { Tower, TOWER_DEFS } from './Tower.js';
import { Projectile, FireZone } from './Projectile.js';
import { WaveManager }    from './WaveManager.js';
import { EconomyManager } from './EconomyManager.js';
import { UIManager }      from './UIManager.js';
import { TutorialManager } from './TutorialManager.js';

export class Game {
  constructor() {
    this.bus         = new EventBus();
    this.state       = 'menu';
    this.mapDef      = null;
    this.mp          = null;  // MultiplayerManager or null
    this.scene       = null;
    this.map         = null;
    this.waveManager = null;
    this.economy     = null;
    this.ui          = null;

    this.enemies     = [];
    this.towers      = [];
    this.projectiles = [];
    this.fireZones   = [];

    this.gameSpeed   = 1;
    this.killCount   = 0;

    this._raycaster  = new THREE.Raycaster();
    this._mouse      = new THREE.Vector2();
    this._clock      = new THREE.Clock(false);
  }

  async init(mapDef, mpManager = null) {
    this.mapDef = mapDef;
    this.mp     = mpManager;
    await AssetLoader.loadAll();

    this.scene = new Scene();
    this.scene.setup();

    this.map = new GameMap(this.scene, mapDef);
    this.map.build();

    const startGold = mapDef.startGold ?? 200;
    this.economy     = new EconomyManager(this.bus, startGold, 20);
    this.waveManager = new WaveManager(this.map.path, this.bus);
    this.ui          = new UIManager(this);

    this.tutorial = new TutorialManager();
    this._bindEvents();
    this._bindInputs();
    if (this.mp) this._bindMpEvents();
  }

  start() {
    const g = this.mapDef.startGold ?? 200;
    this.state = 'between-waves';
    this._clock.start();
    this.ui.showNextWaveButton();
    this.ui.hideSpeedBtn();
    if (!this.mp) this.tutorial.start();
    this.ui.onEconomyChanged({ gold: g, lives: 20, score: 0, maxLives: 20 });
    this.ui.onWindChanged('N');
    this.scene.renderer.setAnimationLoop(() => this._loop());
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  _loop() {
    const rawDelta = Math.min(this._clock.getDelta(), 0.05);
    const delta    = rawDelta * this.gameSpeed;

    if (this.state === 'playing') this._update(delta);

    this.map.update(this.scene.elapsed);
    this.scene.render();
    this.ui.update(delta);
  }

  _update(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(delta);
      if (e.isDead) {
        this.scene.removeObject(e.mesh);
        this.enemies.splice(i, 1);
      } else if (e.hasReachedEnd) {
        this.economy.loseLife(e.liveCost);
        this.scene.removeObject(e.mesh);
        this.enemies.splice(i, 1);
        this.waveManager.onEnemyReachedPort();
      }
    }

    for (const t of this.towers) t.update(delta, this.enemies);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(delta);
      if (p.isDone) {
        if (p.mesh) this.scene.removeObject(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      const z = this.fireZones[i];
      z.update(delta, this.enemies);
      if (z.isDone) {
        this.scene.removeObject(z.mesh);
        this.fireZones.splice(i, 1);
      }
    }

    this.waveManager.update(delta);
  }

  // ── Tower management ──────────────────────────────────────────────────────

  placeTower(type, slot) {
    const cost = TOWER_DEFS[type].cost;
    if (!this.economy.spend(cost)) return;

    const tower = new Tower(type, slot.position, this);
    slot.tower   = tower;
    slot.isEmpty = false;

    slot._disc.material.color.setHex(0x664400);
    slot._disc.material.opacity = 0.18;
    slot._disc.material.emissiveIntensity = 0;
    slot._ring.visible = false;

    this.towers.push(tower);
    this.scene.addObject(tower.mesh);
    this._recalcWatchtowerSynergy();
    this.bus.emit('tower-placed', { tower, slot });

    if (this.mp) {
      this.mp.broadcastTowerPlaced(this.map.slots.indexOf(slot), type);
    }
  }

  // Remote player placed a tower — no local gold cost
  placeRemoteTower(type, slotIndex) {
    const slot = this.map.slots[slotIndex];
    if (!slot || !slot.isEmpty) return;

    const tower = new Tower(type, slot.position, this);
    slot.tower   = tower;
    slot.isEmpty = false;

    // Blue tint to distinguish remote towers
    slot._disc.material.color.setHex(0x224488);
    slot._disc.material.opacity = 0.18;
    slot._disc.material.emissiveIntensity = 0;
    slot._ring.visible = false;

    this.towers.push(tower);
    this.scene.addObject(tower.mesh);
    this._recalcWatchtowerSynergy();
  }

  upgradeTower(tower) {
    const slotIndex = this.map.slots.findIndex(s => s.tower === tower);
    if (!tower.upgrade()) return;
    if (this.mp && slotIndex >= 0) {
      this.mp.broadcastTowerUpgraded(slotIndex);
    }
  }

  upgradeRemoteTower(slotIndex) {
    const slot = this.map.slots[slotIndex];
    if (!slot || !slot.tower) return;
    slot.tower.upgradeFromRemote();
  }

  sellTower(tower, slot) {
    const refund = Math.floor(tower.totalInvested * 0.6);
    this.economy.earn(refund);

    const slotIndex = this.map.slots.indexOf(slot);
    this.towers = this.towers.filter(t => t !== tower);
    this.scene.removeObject(tower.mesh);

    slot.tower   = null;
    slot.isEmpty = true;
    slot._disc.material.color.setHex(0xd4a820);
    slot._disc.material.opacity = 0.65;
    slot._disc.material.emissiveIntensity = 0.4;
    slot._ring.visible = true;

    this._recalcWatchtowerSynergy();

    if (this.mp && slotIndex >= 0) {
      this.mp.broadcastTowerSold(slotIndex);
    }
  }

  sellRemoteTower(slotIndex) {
    const slot = this.map.slots[slotIndex];
    if (!slot || slot.isEmpty) return;
    const tower = slot.tower;

    this.towers = this.towers.filter(t => t !== tower);
    this.scene.removeObject(tower.mesh);

    slot.tower   = null;
    slot.isEmpty = true;
    slot._disc.material.color.setHex(0xd4a820);
    slot._disc.material.opacity = 0.65;
    slot._disc.material.emissiveIntensity = 0.4;
    slot._ring.visible = true;

    this._recalcWatchtowerSynergy();
  }

  spawnProjectile(proj) {
    this.projectiles.push(proj);
    if (proj.mesh) this.scene.addObject(proj.mesh);
  }

  addFireZone(zone) {
    this.fireZones.push(zone);
    this.scene.addObject(zone.mesh);
  }

  _recalcWatchtowerSynergy() {
    for (const t of this.towers) t.rangeBonus = 0;
    const watchers = this.towers.filter(t => t.type === 'watchtower');
    for (const wt of watchers) {
      for (const t of this.towers) {
        if (t === wt) continue;
        if (wt.position.distanceTo(t.position) <= 9) t.rangeBonus += 0.25;
      }
    }
  }

  // ── Speed control ─────────────────────────────────────────────────────────

  cycleSpeed() {
    const levels = [1, 2, 3];
    this.gameSpeed = levels[(levels.indexOf(this.gameSpeed) + 1) % levels.length];
    this.ui.updateSpeedBtn(this.gameSpeed);
  }

  // ── Wave helpers ──────────────────────────────────────────────────────────

  _startWaveLocal() {
    this.ui.hideNextWaveButton();
    this.state = 'playing';
    this.waveManager.startNextWave();
  }

  // ── Multiplayer event wiring ──────────────────────────────────────────────

  _bindMpEvents() {
    this.mp.on('tower-placed',   ({ slotIndex, towerType }) => this.placeRemoteTower(towerType, slotIndex));
    this.mp.on('tower-upgraded', ({ slotIndex }) => this.upgradeRemoteTower(slotIndex));
    this.mp.on('tower-sold',     ({ slotIndex }) => this.sellRemoteTower(slotIndex));
    this.mp.on('wave-start',     () => { if (this.state === 'between-waves') this._startWaveLocal(); });
    this.mp.on('player-left',    ({ nickname }) => this._showToast(`${nickname} saiu da partida`));
    this.mp.on('disconnected',   () => this._showToast('Desconectado do servidor'));
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  _bindEvents() {
    this.bus.on('enemy-died', ({ enemy }) => {
      this.economy.earn(enemy.reward);
      this.waveManager.onEnemyDied();
      this.killCount++;
    });

    this.bus.on('economy-changed', data => this.ui.onEconomyChanged(data));
    this.bus.on('lives-depleted',  () => this._gameOver(false));

    this.bus.on('wave-started', ({ wave, wind }) => {
      this.ui.onWaveChanged(wave);
      this.ui.onWindChanged(wind);
      this.ui.showSpeedBtn();
    });

    this.bus.on('wind-changed', ({ dir }) => this.ui.onWindChanged(dir));

    this.bus.on('wave-complete', () => {
      this.gameSpeed = 1;
      this.ui.updateSpeedBtn(1);
      this.ui.hideSpeedBtn();

      if (this.waveManager.currentWave >= this.waveManager.totalWaves) {
        this._gameOver(true);
      } else {
        const bonus = (this.mapDef.waveBonusBase ?? 60) + this.waveManager.currentWave * 8;
        this.economy.earn(bonus);
        this._showToast(`+${bonus} 🪙 bônus de onda!`);
        this.state = 'between-waves';
        this.ui.showNextWaveButton();
      }
    });

    this.bus.on('spawn-enemy', ({ type }) => {
      const enemy = new Enemy(type, this.map.path, this);
      this.enemies.push(enemy);
      this.scene.addObject(enemy.mesh);
    });

    document.getElementById('btn-next-wave').addEventListener('click', () => {
      if (this.mp) {
        // Start locally + broadcast so partner also starts
        this._startWaveLocal();
        this.mp.broadcastWaveStart();
      } else {
        this._startWaveLocal();
      }
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.mp) this.mp.disconnect();
      window.location.reload();
    });

    this._bindPauseMenu();

    document.getElementById('btn-speed').addEventListener('click', () => {
      if (this.state !== 'playing') return;
      this.cycleSpeed();
    });
  }

  _bindInputs() {
    const keys = {};
    const clearKeys = () => { for (const k in keys) keys[k] = false; };

    window.addEventListener('keydown', e => {
      keys[e.key] = true;
      if (e.key === 'Escape') this.ui.hidePanels();
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape' && this.state === 'paused') this._togglePause();
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.ui.hasSelectedTower()) {
        const { tower, slot } = this.ui.getSelection();
        this.sellTower(tower, slot);
        this.ui.hidePanels();
      }
    });
    window.addEventListener('keyup',  e => { keys[e.key] = false; });
    window.addEventListener('blur',   clearKeys);

    window.addEventListener('wheel', e => {
      if (e.ctrlKey) {
        e.preventDefault();
        this.scene.tilt(e.deltaY > 0 ? -1 : 1);
      } else {
        this.scene.zoom(e.deltaY > 0 ? 1.12 : 0.88);
      }
    }, { passive: false });

    this.scene.setCameraKeyRef(keys);

    const canvas = this.scene.renderer.domElement;
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); clearKeys(); });
    canvas.addEventListener('click',       e => this._onClick(e));
    canvas.addEventListener('mousemove',   e => this._onHover(e));
  }

  _onHover(e) {
    this._mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this.scene.camera);

    const slotMeshes = this.map.slots.flatMap(s => {
      const objs = [s.mesh];
      s.mesh.traverse(n => { if (n !== s.mesh) objs.push(n); });
      return objs;
    });

    const hits = this._raycaster.intersectObjects(slotMeshes, true);
    this.scene.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  }

  _onClick(e) {
    this._mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.scene.camera);

    const slotMeshes = this.map.slots.flatMap(s => {
      const objs = [s.mesh];
      s.mesh.traverse(n => { if (n !== s.mesh) objs.push(n); });
      return objs;
    });

    const hits = this._raycaster.intersectObjects(slotMeshes, true);
    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const slot = this.map.slots.find(s => {
        let node = hitObj;
        while (node) {
          if (node === s.mesh) return true;
          node = node.parent;
        }
        return false;
      });

      if (slot) {
        if (slot.isEmpty) {
          this.ui.showTowerPanel(slot);
        } else {
          this.ui.showUpgradePanel(slot.tower, slot);
        }
        return;
      }
    }

    this.ui.hidePanels();
  }

  _togglePause() {
    if (this.state === 'playing' || this.state === 'between-waves') {
      this._prevState = this.state;
      this.state = 'paused';
      this._clock.stop();
      this._openPauseMenu();
    } else if (this.state === 'paused') {
      this._closePauseMenu();
    }
  }

  _openPauseMenu() {
    const overlay = document.getElementById('pause-overlay');
    const stats   = document.getElementById('pause-stats');
    if (!overlay) return;

    stats.textContent = '';
    const lines = [
      `⚓ Onda: ${this.waveManager.currentWave} / ${this.waveManager.totalWaves}`,
      `💀 Navios abatidos: ${this.killCount}`,
      `🪙 Ouro: ${this.economy.gold}`,
      `⭐ Pontuação: ${this.economy.score}`,
    ];
    for (const line of lines) {
      const p = document.createElement('div');
      p.textContent = line;
      stats.appendChild(p);
    }

    overlay.classList.remove('hidden');
  }

  _closePauseMenu() {
    document.getElementById('pause-overlay')?.classList.add('hidden');
    this.state = this._prevState ?? 'between-waves';
    if (this.state === 'playing') this._clock.start();
  }

  _bindPauseMenu() {
    document.getElementById('btn-pause-hud')?.addEventListener('click', () => this._togglePause());

    document.getElementById('btn-pause-continue')?.addEventListener('click', () => this._closePauseMenu());

    document.getElementById('btn-pause-giveup')?.addEventListener('click', () => {
      document.getElementById('pause-overlay')?.classList.add('hidden');
      this._gameOver(false);
    });

    document.getElementById('btn-pause-tomenu')?.addEventListener('click', () => {
      if (this.mp) this.mp.disconnect();
      window.location.reload();
    });

    document.getElementById('btn-pause-invite')?.addEventListener('click', () => {
      if (this.mp) {
        this._showToast('Já está em modo multijogador!');
        return;
      }
      this._showToast('Em breve: convidar amigo durante a partida 🚧');
    });
  }

  _gameOver(won) {
    this.state = 'gameover';
    this.ui.showGameOver(won, this.economy.score);
  }

  _showToast(msg) {
    const toast = document.getElementById('wave-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden', 'toast-fade');
    void toast.offsetWidth;
    toast.classList.add('toast-fade');
  }
}
