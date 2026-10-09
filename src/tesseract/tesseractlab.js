// Tesseract Lab: three meanings of one word on one stage.
// 1) Hypercube: Interstellar open lattice (bedrooms + world-lines)
// 2) Scanner: pedagogical optical text recognition (Tesseract OCR namesake)
// 3) Artifact: sci-fi Cosmic Cube / magic cube

import * as THREE from 'three';
import { HYPERCUBE_FACTS } from './geometry.js';
import { scanPlate } from './ocr.js';
import { getPreset, PRESETS } from './presets.js';
import { bookshelfTexture, buildLattice } from './interstellar.js';

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    }
  });
}

export class TesseractLab {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.keyLight = new THREE.PointLight(0xffe6c0, 1.4, 0, 1.2);
    this.keyLight.position.set(0, 6, 4);
    this.group.add(this.keyLight);
    this.group.add(new THREE.AmbientLight(0x1a2238, 0.35));
    this.rim = new THREE.DirectionalLight(0x6a8cff, 0.35);
    this.rim.position.set(-30, 20, -40);
    this.group.add(this.rim);

    this.world = new THREE.Group();
    this.group.add(this.world);

    this.bookshelfTex = bookshelfTexture();

    this.family = 'hypercube';
    this.preset = null;
    this.params = {};
    this.t = 0;
    this.playing = true;
    this.scan = null;
    this.scanProgress = 0;
    this.onScan = null;
    this.drift = 0;
    this._prevFog = null;

    this.lattice = null;
    this.latticeRoot = null;
    this.worldLines = null;
    this._core = null;

    this.plateMesh = null;
    this.scanBar = null;
    this.boxGroup = null;
    this.artifactGroup = null;

    this.flyCamera = null;
    this.flyControls = null;

    this.loadPreset('inter-drift');
  }

  /** Let the lab drive the camera through the lattice like Cooper floating. */
  bindFly(camera, controls) {
    this.flyCamera = camera;
    this.flyControls = controls;
  }

  listPresets() { return PRESETS; }

  loadPreset(id) {
    const p = getPreset(id);
    this.preset = p;
    this.family = p.family;
    this.params = { ...(p.params || {}) };
    this.playing = p.params?.auto !== false;
    this.scanProgress = 0;
    this.drift = 0;
    this.rebuild();
  }

  setParam(key, value) {
    this.params[key] = value;
    if (key === 'auto') this.playing = !!value;
    if (this.family === 'scanner' && (key === 'text' || key === 'threshold')) {
      this.runScan();
      this.paintPlate();
      this.paintBoxes();
      return;
    }
    if (this.family === 'artifact' && (key === 'nest' || key === 'energy' || key === 'fold')) {
      this.rebuild();
      return;
    }
    if (this.family === 'hypercube' && (key === 'extent' || key === 'spacing')) {
      this.rebuild();
    }
  }

  setFamily(fam) {
    const first = PRESETS.find((p) => p.family === fam);
    if (first) this.loadPreset(first.id);
  }

  clearWorld() {
    this.clearFog();
    while (this.world.children.length) {
      const c = this.world.children.pop();
      disposeObject(c);
    }
    this.lattice = null;
    this.latticeRoot = null;
    this.worldLines = null;
    this._core = null;
    this.plateMesh = null;
    this.scanBar = null;
    this.boxGroup = null;
    this.artifactGroup = null;
  }

  applyFog() {
    if (!this.scene) return;
    if (!this._prevFog) {
      this._prevFog = {
        fog: this.scene.fog,
        bg: this.scene.background ? this.scene.background.clone() : null,
      };
    }
    this.scene.fog = new THREE.FogExp2(0x030508, 0.028);
    this.scene.background = new THREE.Color(0x030508);
  }

  clearFog() {
    if (!this.scene || !this._prevFog) return;
    this.scene.fog = this._prevFog.fog;
    if (this._prevFog.bg) this.scene.background.copy(this._prevFog.bg);
    else this.scene.background = new THREE.Color(0x000000);
    this._prevFog = null;
  }

  rebuild() {
    this.clearWorld();
    if (this.family === 'hypercube') this.buildHypercube();
    else if (this.family === 'scanner') this.buildScanner();
    else this.buildArtifact();
  }

  // ---------------- Interstellar lattice ----------------

  buildHypercube() {
    this.applyFog();

    const extentN = Math.max(2, Math.min(7, Math.round(this.params.extent ?? 5)));
    const spacing = this.params.spacing ?? 7.2;
    this.lattice = buildLattice({
      extent: { x: extentN, y: Math.max(2, extentN - 2), z: extentN + 2 },
      spacing,
      bookshelfTex: this.bookshelfTex,
    });
    this.latticeRoot = this.lattice.root;
    this.worldLines = this.lattice.worldLines;
    this.world.add(this.latticeRoot);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.world.add(core);
    this._core = core;

    const bulk = new THREE.PointLight(0x88c8ff, 1.2, 80, 1.5);
    bulk.position.set(0, 0, 0);
    this.world.add(bulk);
  }

  updateHypercube(dt) {
    if (!this.latticeRoot) return;
    const speed = this.params.speed ?? 0.45;
    const pulse = this.params.pulse ?? 1;
    const fly = this.params.fly !== false;

    if (this.playing) {
      this.drift += dt * speed * 1.8;
    }

    const spacing = this.lattice.spacing;
    const wrap = spacing;
    const zOff = -((this.drift % wrap) + wrap) % wrap;
    this.latticeRoot.position.z = zOff;
    this.latticeRoot.rotation.y = Math.sin(this.t * 0.08) * 0.12;
    this.latticeRoot.rotation.x = Math.sin(this.t * 0.05) * 0.04;

    if (this.worldLines) {
      this.worldLines.material.opacity = 0.35 + 0.35 * pulse * (0.5 + 0.5 * Math.sin(this.t * 2.2));
    }

    if (this._core) {
      this._core.scale.setScalar(1 + 0.15 * Math.sin(this.t * 1.6));
      this._core.material.opacity = 0.3 + 0.2 * Math.sin(this.t * 2);
    }

    if (this.lattice.dust) {
      this.lattice.dust.rotation.y += dt * 0.02;
      this.lattice.dust.rotation.x += dt * 0.01;
    }

    if (fly && this.flyCamera && this.playing) {
      const cam = this.flyCamera;
      const lookAhead = 14;
      const bob = Math.sin(this.t * 0.55) * 0.35;
      const sway = Math.sin(this.t * 0.33) * 0.55;
      const targetPos = new THREE.Vector3(sway, 1.2 + bob, 2.5);
      cam.position.lerp(targetPos, 1 - Math.exp(-dt * 1.4));
      if (this.flyControls) {
        this.flyControls.target.set(sway * 0.3, 0.6 + bob * 0.4, -lookAhead);
      }
    }
  }

  // ---------------- Scanner ----------------

  buildScanner() {
    this.clearFog();
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.2),
      new THREE.MeshBasicMaterial({ color: 0x121820, transparent: true, opacity: 0.95 })
    );
    this.world.add(board);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(12.2, 4.4)),
      new THREE.LineBasicMaterial({ color: 0x83d63a })
    );
    this.world.add(frame);

    this.plateMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11.2, 3.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
    );
    this.plateMesh.position.z = 0.02;
    this.world.add(this.plateMesh);

    this.scanBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 3.7),
      new THREE.MeshBasicMaterial({
        color: 0x83d63a, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.scanBar.position.z = 0.04;
    this.world.add(this.scanBar);

    this.boxGroup = new THREE.Group();
    this.boxGroup.position.z = 0.05;
    this.world.add(this.boxGroup);

    const label = this.makeAnno('Optical text scanner · Tesseract OCR lineage', 0x9ae66a);
    label.position.set(0, -2.6, 0);
    this.world.add(label);

    this.runScan();
    this.paintPlate();
    this.paintBoxes();
  }

  makeAnno(text, color) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 1024, 64);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = '28px "IBM Plex Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 32);
    const tex = new THREE.CanvasTexture(cv);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(10, 0.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
  }

  runScan() {
    this.scan = scanPlate(this.params.text || 'TESSERACT', {
      threshold: this.params.threshold ?? 128,
      width: 640,
      height: 180,
      fontSize: 56,
    });
    this.scanProgress = 0;
    this.onScan?.(this.scan);
  }

  paintPlate() {
    if (!this.plateMesh || !this.scan) return;
    const tex = new THREE.CanvasTexture(this.scan.plate.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    if (this.plateMesh.material.map) this.plateMesh.material.map.dispose();
    this.plateMesh.material.map = tex;
    this.plateMesh.material.needsUpdate = true;
  }

  paintBoxes() {
    if (!this.boxGroup || !this.scan) return;
    while (this.boxGroup.children.length) {
      const c = this.boxGroup.children.pop();
      disposeObject(c);
    }
    const { width, height } = this.scan.plate;
    const planeW = 11.2, planeH = 3.5;
    for (const g of this.scan.glyphs) {
      if (g.box.space) continue;
      const { x0, x1, y0, y1 } = g.box;
      const cx = ((x0 + x1) / 2 / width - 0.5) * planeW;
      const cy = (0.5 - (y0 + y1) / 2 / height) * planeH;
      const bw = ((x1 - x0) / width) * planeW;
      const bh = ((y1 - y0) / height) * planeH;
      const color = g.correct ? 0x83d63a : 0xf87171;
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(bw + 0.08, bh + 0.08)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
      );
      box.position.set(cx, cy, 0);
      box.userData.glyph = g;
      this.boxGroup.add(box);
    }
  }

  updateScanner(dt) {
    if (!this.scanBar || !this.scan) return;
    const speed = this.params.scanSpeed ?? 1;
    if (this.playing) {
      this.scanProgress = (this.scanProgress + dt * 0.35 * speed) % 1.15;
    }
    const u = Math.min(this.scanProgress, 1);
    this.scanBar.position.x = -5.6 + u * 11.2;
    this.scanBar.material.opacity = this.scanProgress > 1 ? 0.15 : 0.9;

    const planeW = 11.2;
    for (const box of this.boxGroup.children) {
      const g = box.userData.glyph;
      const gx = ((g.box.x0 + g.box.x1) / 2 / this.scan.plate.width - 0.5) * planeW;
      const revealed = this.scanBar.position.x >= gx - 0.2;
      box.visible = revealed;
      box.material.opacity = revealed ? 0.95 : 0;
    }
  }

  // ---------------- Artifact ----------------

  buildArtifact() {
    this.clearFog();
    this.artifactGroup = new THREE.Group();
    this.world.add(this.artifactGroup);

    const nest = Math.max(2, Math.min(6, Math.round(this.params.nest ?? 4)));
    const energy = this.params.energy ?? 1;

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 1),
      new THREE.MeshBasicMaterial({
        color: 0x83d63a, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    core.name = 'core';
    this.artifactGroup.add(core);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
      })
    );
    aura.name = 'aura';
    this.artifactGroup.add(aura);

    for (let i = 0; i < nest; i++) {
      const s = 0.7 + i * 0.55;
      const geo = new THREE.BoxGeometry(s, s, s);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: i % 2 === 0 ? 0x83d63a : 0xc084fc,
          transparent: true,
          opacity: 0.35 + 0.1 * energy,
        })
      );
      edges.userData.layer = i;
      edges.name = 'cage';
      this.artifactGroup.add(edges);

      const faces = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x83d63a : 0x67e8f9,
          transparent: true,
          opacity: 0.03 * energy,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      faces.userData.layer = i;
      faces.name = 'shell';
      this.artifactGroup.add(faces);
    }

    const ribbonCount = Math.floor(24 * energy);
    const rpos = new Float32Array(ribbonCount * 2 * 3);
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const ribbons = new THREE.LineSegments(
      rgeo,
      new THREE.LineBasicMaterial({
        color: 0xfacc15, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    ribbons.name = 'ribbons';
    this.artifactGroup.add(ribbons);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 48),
      new THREE.MeshBasicMaterial({ color: 0x05070e, transparent: true, opacity: 0.65, depthWrite: false })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    this.world.add(floor);
  }

  updateArtifact(dt) {
    if (!this.artifactGroup) return;
    const pulse = this.params.pulse ?? 1;
    const fold = this.params.fold ?? 1;
    const energy = this.params.energy ?? 1;
    const speed = (this.params.speed ?? 0.5) * (this.playing ? 1 : 0);
    const breath = 1 + 0.06 * pulse * Math.sin(this.t * 2.2);

    for (const child of this.artifactGroup.children) {
      if (child.name === 'core') {
        child.scale.setScalar(breath);
        child.rotation.y += dt * 0.8 * speed;
        child.rotation.x += dt * 0.3 * speed;
      } else if (child.name === 'aura') {
        child.scale.setScalar(breath * 1.15);
        child.material.opacity = 0.12 + 0.08 * pulse * (0.5 + 0.5 * Math.sin(this.t * 3));
      } else if (child.name === 'cage' || child.name === 'shell') {
        const layer = child.userData.layer || 0;
        const spin = (0.25 + layer * 0.12) * speed * (layer % 2 === 0 ? 1 : -1);
        child.rotation.x += dt * spin * fold;
        child.rotation.y += dt * spin * 1.3;
        child.rotation.z += dt * spin * 0.4 * fold;
        child.scale.setScalar(1 + 0.04 * fold * Math.sin(this.t * (1.5 + layer * 0.4) + layer));
      } else if (child.name === 'ribbons') {
        const arr = child.geometry.attributes.position.array;
        const n = arr.length / 6;
        for (let i = 0; i < n; i++) {
          const a = this.t * (0.7 + i * 0.05) * speed * 2 + i * 1.7;
          const r = 0.9 + (i % 5) * 0.35 + 0.15 * Math.sin(this.t * 2 + i);
          const y = Math.sin(a * 1.3 + i) * (0.6 + 0.2 * energy);
          const o = i * 6;
          arr[o] = Math.cos(a) * r;
          arr[o + 1] = y;
          arr[o + 2] = Math.sin(a) * r;
          arr[o + 3] = Math.cos(a + 0.25) * (r * 0.92);
          arr[o + 4] = y * 0.9;
          arr[o + 5] = Math.sin(a + 0.25) * (r * 0.92);
        }
        child.geometry.attributes.position.needsUpdate = true;
        child.material.opacity = 0.35 + 0.25 * energy * (0.5 + 0.5 * Math.sin(this.t * 4));
      }
    }
  }

  update(dt) {
    this.t += dt;
    if (this.family === 'hypercube') this.updateHypercube(dt);
    else if (this.family === 'scanner') this.updateScanner(dt);
    else this.updateArtifact(dt);
  }

  onHide() { this.clearFog(); }
  onShow() { if (this.family === 'hypercube') this.applyFog(); }

  status() {
    if (this.family === 'hypercube') {
      const n = this.lattice?.rooms?.length ?? 0;
      return `Tesseract · Interstellar lattice · ${n} rooms · ${this.playing ? 'drifting' : 'held'}`;
    }
    if (this.family === 'scanner') {
      const conf = this.scan ? (this.scan.meanConfidence * 100).toFixed(0) : '--';
      return `Scanner · "${this.scan?.recognized || '...'}" · conf ${conf}%`;
    }
    return `Artifact · nest ${this.params.nest ?? 4} · energy ${(this.params.energy ?? 1).toFixed(1)}`;
  }

  analysis() {
    if (this.family === 'hypercube') {
      return {
        kind: 'hypercube',
        facts: HYPERCUBE_FACTS,
        rooms: this.lattice?.rooms?.length ?? 0,
        spacing: this.lattice?.spacing,
        drift: this.drift,
        extent: this.params.extent,
        note: 'Open lattice of bedroom moments. World-lines are time extruded as space. Auto-fly drifts you through the void.',
      };
    }
    if (this.family === 'scanner' && this.scan) {
      return {
        kind: 'scanner',
        expected: this.scan.expected,
        recognized: this.scan.recognized,
        meanConfidence: this.scan.meanConfidence,
        accuracy: this.scan.accuracy,
        glyphs: this.scan.glyphs.map((g) => ({
          ch: g.ch, expected: g.expected, score: g.score, correct: g.correct,
        })),
      };
    }
    return {
      kind: 'artifact',
      nest: this.params.nest,
      pulse: this.params.pulse,
      energy: this.params.energy,
      fold: this.params.fold,
    };
  }

  pickVertex() { return null; }
}
