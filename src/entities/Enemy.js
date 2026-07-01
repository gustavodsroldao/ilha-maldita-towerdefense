import * as THREE from 'three';
import { AssetLoader } from '../managers/AssetLoader.js';
import { Audio } from '../managers/AudioManager.js';

export const ENEMY_DEFS = {
  barge:   { hp: 80,   speed: 3.5, reward: 10,  liveCost: 1, armor: 0,    color: 0x5a4030, scale: 1.0 },
  frigate: { hp: 180,  speed: 4.5, reward: 20,  liveCost: 2, armor: 0.1,  color: 0x3a3060, scale: 1.2 },
  galleon: { hp: 380,  speed: 2.8, reward: 40,  liveCost: 3, armor: 0.2,  color: 0x4a2040, scale: 1.6 },
  ghost:   { hp: 1800, speed: 5.0, reward: 200, liveCost: 5, armor: 0.5,  color: 0x88aacc, scale: 1.8 },
};

function makeHealthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 8;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(2.2, 0.28, 1);
  sprite.position.y = 2.2;
  sprite.renderOrder = 1;
  sprite.userData = { canvas, ctx: canvas.getContext('2d'), tex };
  return sprite;
}

function updateHealthBar(sprite, ratio) {
  const { canvas, ctx, tex } = sprite.userData;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = ratio > 0.5 ? '#33ee55' : ratio > 0.25 ? '#ffaa11' : '#ee3333';
  ctx.fillRect(1, 1, Math.max(1, Math.floor(ratio * 62)), 6);
  tex.needsUpdate = true;
}

export class Enemy {
  constructor(type, path, game) {
    this.type        = type;
    this.game        = game;
    this.path        = path;               // array of Vector3
    this.wpIndex     = 0;                  // current target waypoint
    const def        = ENEMY_DEFS[type];
    this.maxHp       = def.hp;
    this.hp          = def.hp;
    this.speed       = def.speed;
    this.reward      = def.reward;
    this.liveCost    = def.liveCost;
    this.armor       = def.armor;          // 0–1 flat damage reduction
    this.isDead      = false;
    this.hasReachedEnd = false;
    this.slowMult    = 1.0;
    this._slowTimer  = 0;
    this._fireTimer  = 0;                  // burning DoT
    this._fireDmg    = 0;

    this.mesh = this._buildMesh(type, def);
    this.mesh.position.copy(path[0]);
  }

  _buildMesh(type, def) {
    const grp = new THREE.Group();

    // Map enemy type → Kenney model key + scale
    const MODEL_MAP = {
      barge:   { key: 'ship-small',        scale: 1.0 },
      frigate: { key: 'ship-pirate-medium', scale: 1.0 },
      galleon: { key: 'ship-pirate-large',  scale: 1.0 },
      ghost:   { key: 'ship-ghost',         scale: 1.0 },
    };
    const { key, scale } = MODEL_MAP[type] ?? { key: 'ship-small', scale: 1.0 };
    const model = AssetLoader.get(key);
    model.scale.setScalar(scale);
    model.rotation.y = Math.PI; // orient bow forward along +Z

    if (type === 'ghost') {
      model.traverse(n => {
        if (n.isMesh) {
          n.material.color.setHex(0x88ccff);
          n.material.transparent = true;
          n.material.opacity = 0.72;
        }
      });
    }
    grp.add(model);

    // Health bar sprite
    this._hpBar = makeHealthBar();
    grp.add(this._hpBar);

    grp.castShadow = false;
    return grp;
  }

  update(delta) {
    if (this.isDead || this.hasReachedEnd) return;

    // Slow timer
    if (this._slowTimer > 0) {
      this._slowTimer -= delta;
      if (this._slowTimer <= 0) this.slowMult = 1.0;
    }

    // Fire (burning) DoT
    if (this._fireTimer > 0) {
      this._fireTimer -= delta;
      this.hp -= this._fireDmg * delta;
      if (this.hp <= 0) { this._die(); return; }
    }

    // Move toward current target waypoint
    if (this.wpIndex >= this.path.length) {
      this.hasReachedEnd = true;
      this.mesh.visible = false;
      return;
    }

    const target = this.path[this.wpIndex];
    const dir    = new THREE.Vector3().subVectors(target, this.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // Wind influence — game exposes waveManager.windVector
    let windBonus = 1.0;
    if (this.game.waveManager) {
      const wv  = this.game.waveManager.windVector;
      const dot = dir.length() > 0 ? dir.clone().normalize().dot(wv) : 0;
      if (dot > 0.5)       windBonus = 1.20;
      else if (dot < -0.5) windBonus = 0.85;
    }

    const actualSpeed = this.speed * this.slowMult * windBonus;

    if (dist < actualSpeed * delta + 0.1) {
      this.mesh.position.copy(target);
      this.wpIndex++;
      if (this.wpIndex >= this.path.length) {
        this.hasReachedEnd = true;
        this.mesh.visible = false;
        return;
      }
    } else {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, actualSpeed * delta);
      // Rotate ship to face movement direction
      const angle = Math.atan2(dir.x, dir.z);
      this.mesh.rotation.y = angle;
    }

    updateHealthBar(this._hpBar, this.hp / this.maxHp);
  }

  takeDamage(amount, type = 'cannon') {
    if (this.isDead) return;
    let dmg = amount * (1 - this.armor);
    if (this.type === 'ghost' && type === 'cannon') dmg *= 0.5;
    this.hp -= dmg;
    Audio.playHit();
    if (this.hp <= 0) this._die();
  }

  applyBurn(dps, duration) {
    this._fireDmg  = Math.max(this._fireDmg, dps);
    this._fireTimer = Math.max(this._fireTimer, duration);
  }

  applySlow(duration) {
    this.slowMult   = 0.55;
    this._slowTimer = Math.max(this._slowTimer, duration);
  }

  get isSlowed() { return this.slowMult < 1.0; }

  _die() {
    this.isDead = true;
    this.mesh.visible = false;
    this.game.bus.emit('enemy-died', { enemy: this });
  }
}
