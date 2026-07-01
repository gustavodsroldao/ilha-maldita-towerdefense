import * as THREE from 'three';
import { AssetLoader } from '../managers/AssetLoader.js';

export class GameMap {
  constructor(scene, mapDef) {
    this.scene  = scene;
    this.mapDef = mapDef;
    this.slots  = [];
    this.path   = mapDef.path.map(([x, z]) => new THREE.Vector3(x, 0.1, z));
  }

  build() {
    this._buildIsland();
    this._buildPath();
    this._buildSlots();
    this._buildDecorations();
  }

  resetSlots() {
    for (const s of this.slots) {
      s.tower   = null;
      s.isEmpty = true;
      s._disc.material.color.setHex(0xd4a820);
      s._disc.material.opacity = 0.65;
      s._disc.material.emissiveIntensity = 0.4;
      s._ring.visible = true;
    }
  }

  update(elapsed) {
    for (const slot of this.slots) {
      if (!slot.isEmpty) continue;
      const pulse = Math.sin(elapsed * 2.8);
      slot._disc.material.emissiveIntensity = 0.3 + 0.3 * pulse;
      slot._ring.material.opacity           = 0.5 + 0.3 * Math.sin(elapsed * 2.8 + 0.5);
      slot._ring.scale.setScalar(1 + 0.06 * pulse);
    }
  }

  // ── Island geometry ───────────────────────────────────────────────────────

  _buildIsland() {
    const iMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.95 });
    const bMat = new THREE.MeshStandardMaterial({ color: 0xd4b87a, roughness: 1 });

    const { type } = this.mapDef.island;

    if (type === 'elongated') {
      const scaleZ = this.mapDef.island.scaleZ ?? 1.9;

      const island = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 8, 1), iMat);
      island.scale.z = scaleZ;
      island.position.y = 0.5;
      island.castShadow = island.receiveShadow = true;
      this.scene.addObject(island);

      const beach = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 0.25, 12), bMat);
      beach.scale.z = scaleZ * 1.05;
      beach.position.y = 0.05;
      beach.receiveShadow = true;
      this.scene.addObject(beach);

    } else if (type === 'twin') {
      const islandDefs = [
        { pos: [-10, 0.5, -2], r1: 8, r2: 9 },
        { pos: [ 10, 0.5,  2], r1: 7, r2: 8 },
      ];
      for (const { pos, r1, r2 } of islandDefs) {
        const im = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1.2, 8), iMat.clone());
        im.position.set(...pos);
        im.castShadow = im.receiveShadow = true;
        this.scene.addObject(im);

        const bm = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2 + 1, 0.25, 12), bMat.clone());
        bm.position.set(pos[0], 0.05, pos[2]);
        bm.receiveShadow = true;
        this.scene.addObject(bm);
      }
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.6, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 }),
      );
      bridge.position.set(0, 0.38, 0);
      bridge.castShadow = bridge.receiveShadow = true;
      this.scene.addObject(bridge);

    } else {
      // Standard octagonal island
      const island = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 1.2, 8, 1), iMat);
      island.position.y = 0.5;
      island.castShadow = island.receiveShadow = true;
      this.scene.addObject(island);

      const beach = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 0.25, 12, 1), bMat);
      beach.position.y = 0.05;
      beach.receiveShadow = true;
      this.scene.addObject(beach);
    }

    // Dock — Kenney structure-platform-dock, oriented outward from island center
    const [px, py, pz] = this.mapDef.portPos;
    const dockAngle = Math.atan2(pz, px);
    const dock = AssetLoader.get('structure-platform-dock');
    dock.scale.setScalar(1.3);
    dock.position.set(px, py - 0.3, pz);
    dock.rotation.y = dockAngle;
    dock.castShadow = dock.receiveShadow = true;
    this.scene.addObject(dock);
  }

  _buildPath() {
    const pts   = this.path.map(p => p.clone().setY(0.06));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo   = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120));
    const mat   = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 });
    this.scene.addObject(new THREE.Line(geo, mat));
  }

  _buildSlots() {
    for (const [x, z] of this.mapDef.slots) {
      const y = 1.1; // top of island surface

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78, 1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.1, 24),
        new THREE.MeshStandardMaterial({
          color: 0xd4a820, transparent: true, opacity: 0.65, roughness: 0.5,
          emissive: 0x886600, emissiveIntensity: 0.4,
        }),
      );
      disc.receiveShadow = true;

      const group = new THREE.Group();
      group.add(disc);
      group.add(ring);
      group.position.set(x, y, z);
      this.scene.addObject(group);

      this.slots.push({
        position: new THREE.Vector3(x, y, z),
        mesh: group,
        _disc: disc,
        _ring: ring,
        tower: null,
        isEmpty: true,
      });
    }
  }

  _buildDecorations() {
    const { type } = this.mapDef.island;
    const [px, py, pz] = this.mapDef.portPos;

    // ── Rochas na água (ao redor da beira da ilha) ────────────────────────────
    const waterRocks = [
      { key: 'rocks-a', pos: [-15.0,  0.0, -5.0], ry: 0.4, s: 1.4 },
      { key: 'rocks-b', pos: [ 15.5,  0.0,  3.0], ry: 1.1, s: 1.2 },
      { key: 'rocks-c', pos: [ -6.5, -0.2, 15.5], ry: 2.3, s: 1.3 },
      { key: 'rocks-a', pos: [ 11.5,  0.0, 11.5], ry: 0.8, s: 1.0 },
      { key: 'rocks-b', pos: [-11.0, -0.1,-13.0], ry: 1.6, s: 1.5 },
      { key: 'rocks-c', pos: [  3.0, -0.2, 16.0], ry: 3.1, s: 1.1 },
      { key: 'rocks-a', pos: [-16.5,  0.0,  4.5], ry: 5.0, s: 1.0 },
      { key: 'rocks-b', pos: [  8.5, -0.1,-15.5], ry: 2.7, s: 1.2 },
      { key: 'rocks-c', pos: [-13.0,  0.0,  9.0], ry: 4.2, s: 0.9 },
      { key: 'rocks-a', pos: [ 14.5, -0.1, -9.5], ry: 1.9, s: 1.1 },
    ];

    // ── Rochas na superfície da ilha ──────────────────────────────────────────
    const surfaceRocks = [
      { key: 'rocks-c', pos: [  8.5, 1.1, -5.0], ry: 1.2, s: 0.7 },
      { key: 'rocks-a', pos: [ -9.0, 1.1,  5.5], ry: 2.1, s: 0.8 },
      { key: 'rocks-b', pos: [  5.0, 1.1,  8.0], ry: 0.5, s: 0.65 },
      { key: 'rocks-c', pos: [ -7.0, 1.1, -7.5], ry: 3.5, s: 0.6 },
    ];

    for (const { key, pos, ry, s } of [...waterRocks, ...surfaceRocks]) {
      const m = AssetLoader.get(key);
      m.scale.setScalar(s);
      m.position.set(...pos);
      m.rotation.y = ry;
      this.scene.addObject(m);
    }

    // ── Palmeiras ─────────────────────────────────────────────────────────────
    if (type !== 'elongated') {
      const palmDefs = [
        { key: 'palm-bend',     pos: [  4.0, 1.1, -9.0], s: 1.0,  ry: 0.0 },
        { key: 'palm-straight', pos: [ -2.0, 1.1,  9.0], s: 1.05, ry: 0.0 },
        { key: 'palm-bend',     pos: [  8.0, 1.1,  4.0], s: 0.9,  ry: 1.8 },
        { key: 'palm-straight', pos: [ -7.5, 1.1, -5.5], s: 0.85, ry: 3.0 },
        { key: 'palm-bend',     pos: [  1.5, 1.1,  7.5], s: 1.1,  ry: 0.8 },
        { key: 'palm-straight', pos: [ -5.0, 1.1,  2.0], s: 0.8,  ry: 2.2 },
      ];
      for (const { key, pos, s, ry } of palmDefs) {
        const m = AssetLoader.get(key);
        m.scale.setScalar(s);
        m.position.set(...pos);
        m.rotation.y = ry;
        this.scene.addObject(m);
      }
    }

    // ── Baús ─────────────────────────────────────────────────────────────────
    const chest1 = AssetLoader.get('chest');
    chest1.scale.setScalar(0.85);
    chest1.position.set(px + 1.8, py + 0.2, pz - 1.0);
    chest1.rotation.y = 0.6;
    this.scene.addObject(chest1);

    const chest2 = AssetLoader.get('chest');
    chest2.scale.setScalar(0.75);
    chest2.position.set(-5.5, 1.3, 3.5);
    chest2.rotation.y = -1.2;
    this.scene.addObject(chest2);

    // ── Barris no porto ───────────────────────────────────────────────────────
    for (const [ox, oy, oz] of [[1.0, 0.3, -1.0], [1.0, 0.3, 0.8], [-0.5, 0.3, -0.6]]) {
      const m = AssetLoader.get('barrel');
      m.scale.setScalar(0.9);
      m.position.set(px + ox, py + oy, pz + oz);
      this.scene.addObject(m);
    }

    // ── Bandeira pirata ───────────────────────────────────────────────────────
    const flag = AssetLoader.get('flag-pirate-high');
    flag.scale.setScalar(0.9);
    flag.position.set(px - 2, py + 0.2, pz);
    this.scene.addObject(flag);
  }
}
