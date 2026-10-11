// Offscreen renderer that snapshots 3D models into data-URL images for portraits and icons.
import * as THREE from 'three';

export class Portraits {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab8, 1.8));
    const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(2, 4, 5); this.scene.add(d);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    this.cache = new Map();
  }
  // frame: { w, h, look: [x,y,z], from: [x,y,z], fov }
  snap(key, build, frame = {}) {
    if (key && this.cache.has(key)) return this.cache.get(key);
    const { w = 128, h = 128, look = [0, 1.45, 0], from = [0.5, 1.6, 2.6], fov = 30 } = frame;
    const model = build();
    this.scene.add(model);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = fov; this.camera.updateProjectionMatrix();
    this.camera.position.set(...from); this.camera.lookAt(...look);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(model);
    if (key) this.cache.set(key, url);
    return url;
  }
}
