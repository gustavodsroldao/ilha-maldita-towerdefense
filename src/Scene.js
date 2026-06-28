import * as THREE from 'three';

const WATER_VERT = `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.y += sin(p.x * 0.45 + uTime * 1.4) * 0.38
       + cos(p.z * 0.38 + uTime * 1.1) * 0.28;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const WATER_FRAG = `
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y);
}
float fbm(vec2 p) {
  float v = 0.500 * vnoise(p);
  v      += 0.250 * vnoise(p * 2.1 + vec2(3.1, 1.7));
  v      += 0.125 * vnoise(p * 4.3 + vec2(5.3, 2.9));
  return v / 0.875;
}

void main() {
  float w = sin(vUv.x * 12.0 + uTime) * 0.5 + 0.5;
  vec3 deep    = vec3(0.02, 0.12, 0.30);
  vec3 shallow = vec3(0.06, 0.36, 0.60);
  vec3 col = mix(deep, shallow, w * 0.6);

  vec2 p = vUv * 3.5 + vec2(uTime * 0.07, uTime * 0.05);
  float foam = fbm(p);
  foam = smoothstep(0.58, 0.78, foam);
  col = mix(col, vec3(0.94, 0.97, 1.0), foam * 0.36);

  gl_FragColor = vec4(col, 1.0);
}`;

export class Scene {
  constructor() {
    this.renderer  = null;
    this.camera    = null;
    this.threeScene = new THREE.Scene();
    this._camTarget = new THREE.Vector3(0, 0, 0);
    this._camOffset = new THREE.Vector3(0, 35, 28);
    this._waterMat  = null;
    this._keys      = {};
    this._clock     = new THREE.Clock();
    this._elapsed   = 0;
  }

  setup() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
    this._updateCamera();

    const ambient = new THREE.AmbientLight(0x8899bb, 0.7);
    this.threeScene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5dd, 1.6);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.001;
    this.threeScene.add(sun);

    const fill = new THREE.DirectionalLight(0x4466cc, 0.4);
    fill.position.set(-15, 20, -20);
    this.threeScene.add(fill);

    this.threeScene.fog = new THREE.Fog(0x1a3a5a, 80, 200);

    this._buildSky();
    this._buildWater();

    window.addEventListener('resize', () => this._onResize());
  }

  _buildSky() {
    // Gradient sky dome
    const skyGeo = new THREE.SphereGeometry(280, 16, 10);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float t = clamp(vPos.y / 150.0, 0.0, 1.0);
          vec3 horizon = vec3(0.30, 0.55, 0.75);
          vec3 zenith  = vec3(0.04, 0.16, 0.40);
          gl_FragColor = vec4(mix(horizon, zenith, sqrt(t)), 1.0);
        }
      `,
    });
    this.threeScene.add(new THREE.Mesh(skyGeo, skyMat));

    // Distant island silhouettes at horizon
    const silMat = new THREE.MeshStandardMaterial({ color: 0x061018, roughness: 1 });
    const sils = [
      [ 85, 0, -18, 9,  11, 3.0],
      [-88, 0,  28, 10, 12, 3.5],
      [ 38, 0,  90, 7,   9, 2.5],
      [-28, 0, -92, 11, 13, 4.0],
      [ 75, 0,  68, 6,   8, 2.2],
    ];
    for (const [x, , z, r1, r2, h] of sils) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 7), silMat.clone());
      m.position.set(x, h / 2 - 0.8, z);
      this.threeScene.add(m);
    }
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(320, 320, 64, 64);
    this._waterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
    });
    const water = new THREE.Mesh(geo, this._waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.15;
    water.receiveShadow = true;
    this.threeScene.add(water);
  }

  setCameraKeyRef(keys) { this._keys = keys; }

  addObject(obj) { this.threeScene.add(obj); }
  removeObject(obj) { this.threeScene.remove(obj); }

  zoom(factor) {
    this._camOffset.multiplyScalar(factor);
    const len = this._camOffset.length();
    if (len < 18) this._camOffset.setLength(18);
    if (len > 62) this._camOffset.setLength(62);
    this._updateCamera();
  }

  tilt(dir) { // dir: +1 tilt up (mais de cima), -1 tilt down (mais de lado)
    const hLen = Math.sqrt(this._camOffset.x ** 2 + this._camOffset.z ** 2);
    const totalLen = this._camOffset.length();
    let elev = Math.atan2(this._camOffset.y, hLen);
    elev = Math.max(0.28, Math.min(1.38, elev + dir * 0.045));
    const newHLen = totalLen * Math.cos(elev);
    const scale = hLen > 0.001 ? newHLen / hLen : 1;
    this._camOffset.x *= scale;
    this._camOffset.z *= scale;
    this._camOffset.y = totalLen * Math.sin(elev);
    this._updateCamera();
  }

  render() {
    const dt = this._clock.getDelta();
    this._elapsed += dt;

    if (this._waterMat) this._waterMat.uniforms.uTime.value = this._elapsed;

    // WASD camera pan
    const speed = 0.15;
    const k = this._keys;
    // Order matters: (up × offset) gives correct right-hand screen-right vector
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), this._camOffset).normalize();
    const fwd   = new THREE.Vector3(-this._camOffset.x, 0, -this._camOffset.z).normalize();
    if (k['w'] || k['W'] || k['ArrowUp'])    this._camTarget.addScaledVector(fwd,   speed);
    if (k['s'] || k['S'] || k['ArrowDown'])  this._camTarget.addScaledVector(fwd,  -speed);
    if (k['a'] || k['A'] || k['ArrowLeft'])  this._camTarget.addScaledVector(right, -speed);
    if (k['d'] || k['D'] || k['ArrowRight']) this._camTarget.addScaledVector(right,  speed);

    // Q/E lateral orbit around Y axis
    const rotDir = (k['q'] || k['Q']) ? -1 : (k['e'] || k['E']) ? 1 : 0;
    if (rotDir !== 0) {
      const a = rotDir * 0.022;
      const c = Math.cos(a), s = Math.sin(a);
      const ox = this._camOffset.x * c - this._camOffset.z * s;
      const oz = this._camOffset.x * s + this._camOffset.z * c;
      this._camOffset.x = ox;
      this._camOffset.z = oz;
    }

    this._updateCamera();
    this.renderer.render(this.threeScene, this.camera);
  }

  _updateCamera() {
    this.camera.position.copy(this._camTarget).add(this._camOffset);
    this.camera.lookAt(this._camTarget);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  get elapsed() { return this._elapsed; }
}
