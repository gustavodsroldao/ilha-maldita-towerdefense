import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { Projectile } from './Projectile.js';
import { Audio } from './AudioManager.js';

export const TOWER_DEFS = {
  cannon: {
    icon: '💣', name: 'Canhão',
    desc: '2× dmg em navios lentos',
    range: 13, damage: 35, fireRate: 1.0, cost: 100,
    color: 0x222222,
  },
  pitch: {
    icon: '🔥', name: 'Piche',
    desc: 'Zona de fogo no impacto',
    range: 9,  damage: 0,  fireRate: 0.6, cost: 75,
    color: 0x331100,
  },
  chain: {
    icon: '⛓️', name: 'Corrente',
    desc: 'Desacelera −45% por 2.5s',
    range: 11, damage: 18, fireRate: 0.7, cost: 125,
    color: 0x556677,
  },
  watchtower: {
    icon: '🔭', name: 'Vigia',
    desc: '+25% alcance torres adj.',
    range: 0,  damage: 0,  fireRate: 0,   cost: 50,
    color: 0x8b7355,
  },
  lighthouse: {
    icon: '⚡', name: 'Farol',
    desc: 'Raio encadeia 2 navios',
    range: 13, damage: 28, fireRate: 1.5, cost: 150,
    color: 0x888800,
  },
  kraken: {
    icon: '🐙', name: 'Kraken',
    desc: 'Alto dano, longo alcance',
    range: 17, damage: 75, fireRate: 0.45, cost: 300,
    color: 0x220044,
  },
};

const UPGRADE_MULT = [1, 1.5, 2.1]; // per level (0-indexed)
const UPGRADE_COST_MULT = [0, 0.5, 0.75]; // extra cost multiplier relative to base

export class Tower {
  constructor(type, position, game) {
    this.type         = type;
    this.position     = position.clone();
    this.game         = game;
    this.level        = 1;
    this.rangeBonus   = 0;   // additive from watchtower synergy
    this.totalInvested = TOWER_DEFS[type].cost;

    this._fireTimer   = 0;
    this._target      = null;

    this.mesh = this._buildMesh(type);
    this.mesh.position.copy(position);

    this._rangeRing   = this._buildRangeRing();
    this.mesh.add(this._rangeRing);
    this._rangeRing.visible = false;
  }

  _buildMesh(type) {
    const grp = new THREE.Group();

    if (type === 'cannon') {
      // Kenney cannon on a stone base; _barrel group rotates to aim
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.75, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a6a50, roughness: 0.9 })
      );
      base.castShadow = true;
      grp.add(base);

      this._barrel = new THREE.Group();
      const model = AssetLoader.get('cannon');
      model.scale.setScalar(1.1);
      model.position.y = -0.1;
      this._barrel.add(model);
      this._barrel.position.y = 0.45;
      grp.add(this._barrel);

    } else if (type === 'pitch') {
      // No specific Kenney model — burning cauldron built from primitives
      const pot = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x110800, roughness: 1 })
      );
      pot.position.y = 0.55; pot.castShadow = true;
      grp.add(pot);
      const fire = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.7, 6),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.2 })
      );
      fire.position.y = 1.35;
      grp.add(fire);

    } else if (type === 'chain') {
      // Mobile cannon represents the chain/anchor tower
      const model = AssetLoader.get('cannon-mobile');
      model.scale.setScalar(1.1);
      grp.add(model);

    } else if (type === 'watchtower') {
      const model = AssetLoader.get('tower-watch');
      model.scale.setScalar(1.2);
      grp.add(model);

    } else if (type === 'lighthouse') {
      const model = AssetLoader.get('tower-complete-small');
      model.scale.setScalar(1.1);
      // Tint yellow-white to signal electric/light tower
      model.traverse(n => {
        if (n.isMesh) n.material.emissive?.setHex(0x332200);
      });
      grp.add(model);

    } else if (type === 'kraken') {
      const model = AssetLoader.get('tower-complete-large');
      model.scale.setScalar(1.0);
      // Keep original Kenney texture — just add subtle dark emissive tint
      model.traverse(n => {
        if (n.isMesh && n.material) {
          n.material.emissive = new THREE.Color(0x110022);
          n.material.emissiveIntensity = 0.4;
        }
      });
      grp.add(model);
    }

    return grp;
  }

  _applyLevelVisual() {
    // Scale slightly with level
    this.mesh.scale.setScalar([1.0, 1.08, 1.16][this.level - 1]);

    // Remove old level ring
    const old = this.mesh.getObjectByName('lvl-ring');
    if (old) this.mesh.remove(old);

    if (this.level < 2) return;

    const color = this.level === 2 ? 0x44aaff : 0xffcc00;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.06, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.name = 'lvl-ring';
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
    this.mesh.add(ring);
  }

  _buildRangeRing() {
    const geo = new THREE.RingGeometry(this.effectiveRange - 0.05, this.effectiveRange + 0.05, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.9; // relative to tower mesh which sits on island
    return ring;
  }

  showRange(visible) {
    this._rangeRing.visible = visible;
    if (visible) {
      // Rebuild ring with current effective range
      this.mesh.remove(this._rangeRing);
      this._rangeRing = this._buildRangeRing();
      this.mesh.add(this._rangeRing);
      this._rangeRing.visible = true;
    }
  }

  get effectiveRange() {
    const def = TOWER_DEFS[this.type];
    return def.range * UPGRADE_MULT[this.level - 1] * (1 + this.rangeBonus);
  }

  get upgradeCost() {
    if (this.level >= 3) return Infinity;
    return Math.floor(TOWER_DEFS[this.type].cost * UPGRADE_COST_MULT[this.level]);
  }

  upgrade() {
    if (this.level >= 3) return false;
    const cost = this.upgradeCost;
    if (!this.game.economy.spend(cost)) return false;
    this.totalInvested += cost;
    this.level++;
    this._applyLevelVisual();
    this.game.bus.emit('tower-upgraded', { tower: this });
    return true;
  }

  // Remote player paid — skip economy, skip totalInvested
  upgradeFromRemote() {
    if (this.level >= 3) return;
    this.level++;
  }

  update(delta, enemies) {
    if (TOWER_DEFS[this.type].fireRate === 0) return; // passive tower

    this._fireTimer -= delta;

    // Find target — nearest enemy in range
    this._target = this._findTarget(enemies);
    if (!this._target) return;

    // Point barrel at target
    if (this._barrel) {
      const dir = new THREE.Vector3().subVectors(this._target.mesh.position, this.position);
      this._barrel.parent.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      const dir = new THREE.Vector3().subVectors(this._target.mesh.position, this.position);
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const rate = TOWER_DEFS[this.type].fireRate * UPGRADE_MULT[this.level - 1];
    if (this._fireTimer <= 0) {
      this._fireTimer = 1 / rate;
      this._shoot(this._target);
    }
  }

  _findTarget(enemies) {
    const range = this.effectiveRange;
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (e.isDead || e.hasReachedEnd) continue;
      const d = this.position.distanceTo(e.mesh.position);
      if (d <= range && d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  _shoot(target) {
    const def    = TOWER_DEFS[this.type];
    const dmg    = def.damage * UPGRADE_MULT[this.level - 1];
    const origin = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));

    if (this.type === 'lighthouse') {
      Audio.playLightning();
    } else if (this.type !== 'watchtower') {
      Audio.playCannon();
    }

    const proj = this.type === 'lighthouse'
      ? new Projectile({ origin, target, type: 'lightning', damage: dmg, game: this.game, extraData: { jumps: 2 } })
      : new Projectile({ origin, target, type: this.type,   damage: dmg, game: this.game });

    this.game.spawnProjectile(proj);
  }
}
