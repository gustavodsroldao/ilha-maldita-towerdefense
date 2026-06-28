import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _cache = new Map();
const _loader = new GLTFLoader();

// Real filenames from Kenney Pirate Kit (CC0)
const MODEL_NAMES = [
  'ship-small', 'ship-medium', 'ship-large', 'ship-ghost',
  'ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large',
  'cannon', 'cannon-mobile',
  'tower-watch', 'tower-complete-small', 'tower-complete-large',
  'chest', 'flag-pirate-high', 'barrel',
  'rocks-a', 'rocks-b', 'rocks-c',
  'palm-bend', 'palm-straight',
  'structure-platform-dock',
];

function makeFallback(name) {
  let geo, color;
  if (name.startsWith('ship')) {
    const isGhost = name === 'ship-ghost';
    const isPirate = name.includes('pirate');
    geo   = new THREE.BoxGeometry(3, 1, 1.5);
    color = isGhost ? 0x88aacc : isPirate ? 0x3a2820 : 0xc8b890;
  } else if (name === 'cannon' || name === 'cannon-mobile') {
    geo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8);
    color = 0x2a2a2a;
  } else if (name.startsWith('tower')) {
    const g = new THREE.Group();
    g.add(Object.assign(
      new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a6550 })),
      { castShadow: true }
    ));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x553322 }));
    top.position.y = 1.45; top.castShadow = true;
    g.add(top);
    const wrap = new THREE.Group(); wrap.add(g);
    return { scene: wrap };
  } else if (name.startsWith('rocks')) {
    geo = new THREE.DodecahedronGeometry(0.7, 0); color = 0x6a6058;
  } else if (name.startsWith('palm')) {
    geo = new THREE.CylinderGeometry(0.12, 0.18, 3, 5); color = 0x7a5c2a;
  } else {
    geo = new THREE.BoxGeometry(0.8, 0.8, 0.8); color = 0x888888;
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  return { scene: g };
}

export class AssetLoader {
  static async loadAll() {
    await Promise.all(
      MODEL_NAMES.map(name =>
        new Promise(resolve => {
          _loader.load(
            `assets/models/${name}.glb`,
            gltf => { _cache.set(name, gltf); resolve(); },
            undefined,
            () => { _cache.set(name, makeFallback(name)); resolve(); }
          );
        })
      )
    );
    console.log(`AssetLoader: ${_cache.size} models ready`);
  }

  // Returns a deep-cloned scene node; each instance is independent.
  static get(name) {
    const entry = _cache.get(name) ?? makeFallback(name);
    const clone = entry.scene.clone(true);
    clone.traverse(n => {
      if (n.isMesh) {
        n.castShadow    = true;
        n.receiveShadow = true;
        // Clone material so per-instance color changes don't bleed across copies
        if (n.material) n.material = n.material.clone();
      }
    });
    return clone;
  }
}
