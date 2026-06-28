import * as THREE from 'three';

const _ballGeo  = new THREE.SphereGeometry(0.22, 6, 6);
const _pitchGeo = new THREE.SphereGeometry(0.30, 6, 6);
const _chainGeo = new THREE.SphereGeometry(0.20, 6, 6);

// Shared materials (created lazily)
let _ballMat, _pitchMat, _chainMat, _lightMat;

function getMat(type) {
  if (type === 'cannon') return (_ballMat  ??= new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x331100 }));
  if (type === 'pitch')  return (_pitchMat ??= new THREE.MeshStandardMaterial({ color: 0x1a0a00, emissive: 0xff4400, emissiveIntensity: 0.8 }));
  if (type === 'chain')  return (_chainMat ??= new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 }));
  return (_lightMat ??= new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xccddff, emissiveIntensity: 2 }));
}

export class Projectile {
  constructor({ origin, target, type, damage, game, extraData = {} }) {
    this.target    = target;      // Enemy instance
    this.type      = type;
    this.damage    = damage;
    this.game      = game;
    this.isDone    = false;
    this._extra    = extraData;   // chain count, etc.

    const geo = type === 'pitch' ? _pitchGeo : type === 'chain' ? _chainGeo : _ballGeo;
    this.mesh = new THREE.Mesh(geo, getMat(type));
    this.mesh.position.copy(origin);
    this.mesh.castShadow = false;

    // Cannon moves faster, pitch is lobbed (arc tracked by time)
    this._speed = type === 'lightning' ? 0 : (type === 'cannon' ? 22 : 14);
    this._origin     = origin.clone();
    this._arcTime    = 0;
    this._arcDur     = type === 'pitch' ? 1.0 : 0;  // seconds for pitch arc
    this._targetPos  = target ? target.mesh.position.clone() : origin.clone();
  }

  update(delta) {
    if (this.isDone) return;

    if (this.type === 'lightning') {
      // Instant — apply damage and chain immediately on first frame
      this._applyLightning();
      this.isDone = true;
      return;
    }

    if (this.type === 'pitch') {
      // Ballistic arc
      this._arcTime += delta;
      const t = Math.min(this._arcTime / this._arcDur, 1);
      this.mesh.position.lerpVectors(this._origin, this._targetPos, t);
      this.mesh.position.y += Math.sin(t * Math.PI) * 5;
      if (t >= 1) { this._onHit(); }
      return;
    }

    // cannon / chain — homing toward enemy current position
    const dest = (this.target && !this.target.isDead && !this.target.hasReachedEnd)
      ? this.target.mesh.position
      : this._targetPos;

    const dir  = new THREE.Vector3().subVectors(dest, this.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist < this._speed * delta + 0.3) {
      this._onHit();
    } else {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, this._speed * delta);
      this.mesh.position.y = 1.2;
    }
  }

  _onHit() {
    this.isDone = true;

    if (!this.target || this.target.isDead) return;

    if (this.type === 'pitch') {
      // Create fire zone at impact position
      this.game.addFireZone(new FireZone(this._targetPos.clone(), 10, 5.0, this.game));
      return;
    }

    if (this.type === 'chain') {
      this.target.takeDamage(this.damage, 'chain');
      this.target.applySlow(2.5);
      return;
    }

    // cannon — bonus damage vs slowed enemies (synergy)
    const mult = (this.type === 'cannon' && this.target.isSlowed) ? 2.0 : 1.0;
    this.target.takeDamage(this.damage * mult, this.type);
  }

  _applyLightning() {
    if (!this.target || this.target.isDead) return;
    this.target.takeDamage(this.damage, 'lightning');

    // Chain to 2 nearby enemies
    const maxJumps = this._extra.jumps ?? 2;
    if (maxJumps <= 0) return;
    const jumped = new Set([this.target]);
    let current = this.target;
    for (let i = 0; i < maxJumps; i++) {
      const next = this._nearestNotJumped(current.mesh.position, jumped, 6);
      if (!next) break;
      jumped.add(next);
      next.takeDamage(this.damage * 0.6, 'lightning');
      current = next;
    }
  }

  _nearestNotJumped(pos, jumped, radius) {
    let best = null, bestD = radius;
    for (const e of this.game.enemies) {
      if (jumped.has(e) || e.isDead) continue;
      const d = pos.distanceTo(e.mesh.position);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }
}

// ── Fire Zone ──────────────────────────────────────────────────────────────────
export class FireZone {
  constructor(position, dps, lifetime, game) {
    this.position = position;
    this.dps      = dps;
    this.lifetime = lifetime;
    this.game     = game;
    this.isDone   = false;
    this._elapsed = 0;

    // Visual: glowing disc on water
    const geo = new THREE.CylinderGeometry(3, 3, 0.05, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff2200, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.55,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.08;
  }

  update(delta, enemies) {
    if (this.isDone) return;
    this._elapsed += delta;
    if (this._elapsed >= this.lifetime) { this.isDone = true; return; }

    // Fade out
    const ratio = 1 - this._elapsed / this.lifetime;
    this.mesh.material.opacity = ratio * 0.55;
    this.mesh.material.emissiveIntensity = ratio * 1.2;

    // Apply burn to enemies in radius
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = this.position.distanceTo(e.mesh.position);
      if (d <= 3.2) e.applyBurn(this.dps, 0.5); // re-apply each frame tick
    }
  }
}
