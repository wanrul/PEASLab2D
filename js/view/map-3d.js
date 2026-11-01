/**
 * CollabPEAS - 3D 360-Degree Interactive Apartment Map Engine
 * Powered by Three.js WebGL and Materials/Apartment.glb.
 * Features 360° OrbitControls, First-Person 360° Walkthrough,
 * 3D Holographic Stations, 3D Dynamic Robot with Sonar, 3D Roaming Cat NPC,
 * 3D Operator Avatar, Floor Decals, and Raycasting Interaction.
 */

import * as THREE from '../../lib/three/three.module.js';
import { GLTFLoader } from '../../lib/three/GLTFLoader.js';
import { OrbitControls } from '../../lib/three/OrbitControls.js';
import { appState } from '../state.js';
import { getRobotCameraPose } from './pov-renderer.js';

export class Apartment3DMap {
  constructor(canvasElement, world) {
    this.canvas = canvasElement;
    this.world = world;

    // View Modes: 'orbit' | 'fps' (player walkthrough) | 'robot' (robot camera) | 'topDown'
    this.viewMode = 'orbit';
    this.isAutoSpinning = false;
    this.modelLoaded = false;

    // First-person walkthrough camera state
    this.fpsPitch = 0;
    this.fpsYaw = 0;
    this.isMouseDown = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    // Station holographic rings & click targets
    this.stationObjects = [];
    this.hoveredStation = null;

    // Raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initScene();
    this.initLighting();
    this.initControls();
    this.initEntities();
    this.createInspectionObjects();
    this.loadApartmentModel();
    this.bindEvents();
    this.startLoop();
  }

  // -------------------------------------------------------------
  // 1. SCENE, CAMERA & RENDERER SETUP
  // -------------------------------------------------------------
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeaf0f5);

    // Perspective Camera for natural 3D depth and 360° exploration
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);

    // Initial 360° orbital vantage point (isometric angle)
    this.camera.position.set(4, 14, 18);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initLighting() {
    // Local daylight reflection keeps imported metal/wood finishes from going black.
    const environment = document.createElement('canvas');
    environment.width = 512;
    environment.height = 256;
    const context = environment.getContext('2d');
    const daylight = context.createLinearGradient(0, 0, 0, 256);
    daylight.addColorStop(0, '#eaf4ff');
    daylight.addColorStop(0.45, '#ffffff');
    daylight.addColorStop(1, '#b8a58e');
    context.fillStyle = daylight;
    context.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(environment);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = generator.fromEquirectangular(texture);
    this.scene.environment = this.environmentTarget.texture;
    texture.dispose();
    generator.dispose();

    // Soft balanced ambient illumination for interior viewing
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);
    this.scene.add(new THREE.HemisphereLight(0xf4f9ff, 0xd9cbbb, 0.35));

    // Directional architectural sun light
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight.position.set(12, 22, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 16;
    dirLight.shadow.camera.bottom = -16;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Subtle warm interior point lights across key rooms
    const roomLights = [
      { x: 1.0, y: 3.2, z: -2.0, color: 0xffedd5, intensity: 1.2 }, // Living Room
      { x: -1.5, y: 3.2, z: 4.5, color: 0xe0f2fe, intensity: 1.0 }, // Kitchen
      { x: 3.5, y: 3.2, z: 5.0, color: 0xfef3c7, intensity: 1.1 },  // Dining
      { x: 8.8, y: 3.2, z: 5.0, color: 0xfce7f3, intensity: 1.0 },  // Bedroom
      { x: 8.8, y: 3.2, z: -1.5, color: 0xdbeafe, intensity: 1.2 }  // Bathroom
    ];

    roomLights.forEach(l => {
      const pl = new THREE.PointLight(l.color, l.intensity, 12, 1.2);
      pl.position.set(l.x, l.y, l.z);
      this.scene.add(pl);
    });
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.screenSpacePanning = true;

    // Orbit 360° limits
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 35.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't flip under the floor
    this.controls.minPolarAngle = 0.05; // Bird's eye

    // Focus target near center of apartment
    this.controls.target.set(3.5, 0.5, 0.0);
    this.controls.update();
  }

  // -------------------------------------------------------------
  // 2. COORDINATE TRANSFORMATIONS (2D Canvas World <-> 3D GLB Model)
  // -------------------------------------------------------------
  to3D(x2d, y2d, yElev = 0.12) {
    // 2D: X from 130 to 1080 (span 950) -> 3D: X from -5.0 to 12.5 (span 17.5)
    // 2D: Y from 90 to 1010 (span 920) -> 3D: Z from -7.5 to 7.5 (span 15.0)
    const x3d = -5.0 + ((x2d - 130) / 950) * 17.5;
    const z3d = -7.5 + ((y2d - 90) / 920) * 15.0;
    return new THREE.Vector3(x3d, yElev, z3d);
  }

  to2D(x3d, z3d) {
    const x2d = 130 + ((x3d + 5.0) / 17.5) * 950;
    const y2d = 90 + ((z3d + 7.5) / 15.0) * 920;
    return { x: x2d, y: y2d };
  }

  // -------------------------------------------------------------
  // 3. LOAD APARTMENT GLB MODEL
  // -------------------------------------------------------------
  loadApartmentModel() {
    const progressFill = document.getElementById('glbProgressFill');
    const progressText = document.getElementById('glbProgressText');
    const overlay = document.getElementById('glbLoadingOverlay');
    const cancelBtn = document.getElementById('cancelGlbLoadBtn');

    const hideOverlay = () => {
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 250);
      }
    };

    // Dismiss loading without changing the selected view.
    cancelBtn?.addEventListener('click', () => {
      hideOverlay();
    });

    // Dismiss a slow loading overlay without changing the learner's selected view.
    const safetyTimer = setTimeout(() => {
      if (!this.modelLoaded) {
        console.warn('⏱️ GLB loading taking long; keeping the selected view while loading.');
        hideOverlay();
      }
    }, 8000);

    const loader = new GLTFLoader();
    loader.load(
      'assets/Apartment.glb',
      (gltf) => {
        clearTimeout(safetyTimer);
        try {
          this.apartmentModel = gltf.scene;
          this.apartmentModel.position.set(0, 0, 0);

          // Keep textures while lifting the original near-black furniture finishes.
          const furnitureFinishes = {
            'Adler Dark Wood': 0x886244,
            'Ebony Wood': 0xa3a3a3,
            'Leather_01': 0xad8d6e,
            'BA_Leather_01': 0x948a7e,
            'Cabinets_02': 0x667e94,
            'BA_Color_Black_01': 0x4b5563
          };
          this.apartmentModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                if (!material) continue;
                material.roughness = Math.max(0.25, material.roughness || 0.6);
                if (furnitureFinishes[material.name] !== undefined) material.color.setHex(furnitureFinishes[material.name]);
              }
            }
          });

          this.scene.add(this.apartmentModel);
          this.modelLoaded = true;
          console.log('✅ Apartment.glb Loaded Successfully into 360° WebGL View.');
          window.dispatchEvent(new CustomEvent('glbModelLoaded', {detail:{mapImage:this.createMapImage()}}));
        } catch (err) {
          console.error('Error processing Apartment.glb scene:', err);
        } finally {
          hideOverlay();
        }
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (progressText) progressText.innerText = `${pct}% Loaded (${(xhr.loaded / 1048576).toFixed(1)} MB)`;
        } else if (xhr.loaded > 0) {
          const mb = (xhr.loaded / 1048576).toFixed(1);
          if (progressText) progressText.innerText = `${mb} MB Loaded`;
          if (progressFill) progressFill.style.width = `${Math.min(95, Math.round(xhr.loaded / 850000))}%`;
        }
      },
      (err) => {
        clearTimeout(safetyTimer);
        console.warn('⚠️ Error loading Apartment.glb:', err);
        hideOverlay();
        window.switchViewMode?.('fallback');
      }
    );
  }

  createMapImage() {
    const {width,height} = this.world;
    const min = this.to3D(0,0), max = this.to3D(width,height);
    const camera = new THREE.OrthographicCamera(min.x,max.x,-min.z,-max.z,0.1,100);
    camera.position.set(0,40,0);
    camera.up.set(0,0,-1);
    camera.lookAt(0,0,0);
    const target = new THREE.WebGLRenderTarget(width,height);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const previousTarget = this.renderer.getRenderTarget(), background = this.scene.background;
    const hidden = this.scene.children.filter(child => child !== this.apartmentModel && !child.isLight && child.visible);
    const pixels = new Uint8Array(width*height*4);
    try {
      hidden.forEach(child => { child.visible = false; });
      this.scene.background = new THREE.Color(0xeaf0f5);
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene,camera);
      this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.scene.background = background;
      hidden.forEach(child => { child.visible = true; });
      target.dispose();
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'), image = context.createImageData(width,height);
    for (let y=0;y<height;y++) image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
    context.putImageData(image,0,0);
    return canvas;
  }

  // -------------------------------------------------------------
  // 4. INTERACTIVE 3D ENTITIES (Stations, Robot, Cat, Avatar, Decals)
  // -------------------------------------------------------------
  initEntities() {
    this.create3DStations();
    this.create3DRobot();
    this.create3DCat();
    this.create3DAvatar();
    this.createFloorDecals();
  }

  create3DStations() {
    const STATIONS_DEF = [
      { step: 1, name: '1. Purpose & Metrics', x2d: 450, y2d: 380, icon: '🎯', color: 0x38bdf8 },
      { step: 2, name: '2. Sensors Workbench', x2d: 340, y2d: 820, icon: '📡', color: 0x0284c7 },
      { step: 3, name: '3. Actuator Bay', x2d: 350, y2d: 480, icon: '🦾', color: 0x10b981 },
      { step: 4, name: '4. Decision Logic', x2d: 600, y2d: 860, icon: '🧩', color: 0xf59e0b },
      { step: 5, name: '5. Observation & Debug', x2d: 880, y2d: 860, icon: '🔬', color: 0xa855f7 }
    ];

    STATIONS_DEF.forEach(st => {
      const safe = this.world.nearestWalkable(st.x2d, st.y2d, 24);
      const pos = this.to3D(safe.x, safe.y, 0.12);

      const group = new THREE.Group();
      group.position.copy(pos);
      group.userData = { step: st.step, name: st.name, isStation: true };

      // Ground Holographic Ring
      const ringGeom = new THREE.TorusGeometry(0.75, 0.045, 16, 48);
      ringGeom.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({
        color: st.color,
        emissive: st.color,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      group.add(ringMesh);

      // Vertical Soft Glowing Light Column
      const colGeom = new THREE.CylinderGeometry(0.7, 0.7, 1.8, 32, 1, true);
      colGeom.translate(0, 0.9, 0);
      const colMat = new THREE.MeshBasicMaterial({
        color: st.color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const colMesh = new THREE.Mesh(colGeom, colMat);
      group.add(colMesh);

      // Overhead 3D Billboard Sprite
      const sprite = this.createStationBillboard(st.icon, st.name, st.color);
      sprite.position.set(0, 2.2, 0);
      group.add(sprite);

      this.scene.add(group);
      this.stationObjects.push({ group, ringMesh, colMesh, sprite, def: st });
    });
  }

  createStationBillboard(icon, text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 128, 28);
    ctx.fill();
    ctx.stroke();

    // Icon & Text
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(icon, 36, 102);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(text, 110, 96);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: true, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.75, 1);
    return sprite;
  }

  create3DRobot() {
    this.robotGroup = new THREE.Group();

    // 1. Lower Pulsing Ground Halo Disc (ensures high visibility from high camera angles)
    const groundGeom = new THREE.RingGeometry(0.60, 0.82, 36);
    groundGeom.rotateX(-Math.PI / 2);
    this.robotGroundMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.robotGroundBeacon = new THREE.Mesh(groundGeom, this.robotGroundMat);
    this.robotGroundBeacon.position.y = -0.11;
    this.robotGroup.add(this.robotGroundBeacon);

    // 2. Vertical Holographic Target Column (Beacon Beam)
    const beamGeom = new THREE.CylinderGeometry(0.38, 0.38, 1.8, 24, 1, true);
    beamGeom.translate(0, 0.9, 0);
    this.robotBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.robotBeam = new THREE.Mesh(beamGeom, this.robotBeamMat);
    this.robotBeam.renderOrder = 8888;
    this.robotGroup.add(this.robotBeam);

    // 3. Main Metallic Chassis Body
    const bodyGeom = new THREE.CylinderGeometry(0.48, 0.50, 0.20, 36);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.robotGroup.add(body);

    // 4. Chrome Top Shell Trim
    const topShellGeom = new THREE.CylinderGeometry(0.44, 0.46, 0.04, 36);
    const topShellMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.15
    });
    const topShell = new THREE.Mesh(topShellGeom, topShellMat);
    topShell.position.y = 0.11;
    this.robotGroup.add(topShell);

    // 5. Rotating Lidar Scanner Turret
    const turretBaseGeom = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 24);
    const turretBaseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const turretBase = new THREE.Mesh(turretBaseGeom, turretBaseMat);
    turretBase.position.y = 0.15;
    this.robotGroup.add(turretBase);

    this.robotLidarTurret = new THREE.Group();
    this.robotLidarTurret.position.y = 0.19;
    const lidarHeadGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16);
    const lidarHeadMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 });
    const lidarHead = new THREE.Mesh(lidarHeadGeom, lidarHeadMat);
    this.robotLidarTurret.add(lidarHead);

    const lidarEyeGeom = new THREE.BoxGeometry(0.05, 0.03, 0.04);
    const lidarEyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const lidarEye = new THREE.Mesh(lidarEyeGeom, lidarEyeMat);
    lidarEye.position.set(0, 0, 0.08);
    this.robotLidarTurret.add(lidarEye);
    this.robotGroup.add(this.robotLidarTurret);

    // 6. Glowing LED Halo Perimeter Ring
    const ledGeom = new THREE.TorusGeometry(0.48, 0.035, 16, 48);
    ledGeom.rotateX(Math.PI / 2);
    this.robotLedMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });
    const ledMesh = new THREE.Mesh(ledGeom, this.robotLedMat);
    ledMesh.position.y = 0.09;
    this.robotGroup.add(ledMesh);

    // 7. Dual Forward Headlights / Navigation Eyes
    const lightGeom = new THREE.SphereGeometry(0.05, 16, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftLight = new THREE.Mesh(lightGeom, lightMat);
    leftLight.position.set(-0.22, 0.05, 0.44);
    const rightLight = new THREE.Mesh(lightGeom, lightMat);
    rightLight.position.set(0.22, 0.05, 0.44);
    this.robotGroup.add(leftLight);
    this.robotGroup.add(rightLight);

    // 8. Front Directional Bumper
    const bumpGeom = new THREE.BoxGeometry(0.30, 0.10, 0.12);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5 });
    const bumper = new THREE.Mesh(bumpGeom, bumpMat);
    bumper.position.set(0, 0.03, 0.44);
    this.robotGroup.add(bumper);

    // 9. Overhead High-Visibility Billboard (Elevated & Rendered on top of everything)
    this.robotActionSprite = this.createRobotActionSprite('⚙️ READY • 🔋 100%');
    this.robotActionSprite.position.set(0, 1.30, 0);
    this.robotGroup.add(this.robotActionSprite);

    // Immediately position the robot group at world coordinates
    const initPos = this.to3D(this.world.robot.x, this.world.robot.y, 0.24);
    this.robotGroup.position.copy(initPos);
    this.robotGroup.rotation.y = -this.world.robot.heading + Math.PI / 2;

    this.scene.add(this.robotGroup);
  }

  createRobotActionSprite(actionText) {
    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 110;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 424, 94, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤖 CLEANING ROBOT', 220, 42);

    ctx.fillStyle = '#166534';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillText(actionText, 220, 80);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.6, 0.65, 1);
    sprite.renderOrder = 9999;
    sprite.canvas = canvas;
    sprite.ctx = ctx;
    sprite.texture = texture;
    return sprite;
  }

  updateRobotActionSprite(text) {
    if (!this.robotActionSprite) return;
    const { canvas, ctx, texture } = this.robotActionSprite;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, 424, 94, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤖 CLEANING ROBOT', 220, 42);

    ctx.fillStyle = '#166534';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillText(text, 220, 80);

    texture.needsUpdate = true;
  }

  create3DCat() {
    this.catGroup = new THREE.Group();

    // Body
    const bodyGeom = new THREE.CapsuleGeometry(0.14, 0.32, 8, 16);
    bodyGeom.rotateX(Math.PI / 2);
    const catMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeom, catMat);
    body.position.y = 0.16;
    body.castShadow = true;
    this.catGroup.add(body);

    // Head
    const headGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const head = new THREE.Mesh(headGeom, catMat);
    head.position.set(0, 0.24, 0.24);
    this.catGroup.add(head);

    // Ears
    const earGeom = new THREE.ConeGeometry(0.05, 0.1, 8);
    const earL = new THREE.Mesh(earGeom, catMat);
    earL.position.set(-0.06, 0.34, 0.24);
    const earR = new THREE.Mesh(earGeom, catMat);
    earR.position.set(0.06, 0.34, 0.24);
    this.catGroup.add(earL);
    this.catGroup.add(earR);

    // Tail
    const tailGeom = new THREE.CylinderGeometry(0.025, 0.02, 0.26, 8);
    tailGeom.rotateX(-Math.PI / 4);
    const tail = new THREE.Mesh(tailGeom, catMat);
    tail.position.set(0, 0.22, -0.22);
    this.catGroup.add(tail);

    this.scene.add(this.catGroup);
  }

  create3DAvatar() {
    this.avatarGroup = new THREE.Group();

    // Stylized Operator Humanoid
    const learnerColor = 0x2563eb;

    // Torso
    const torsoGeom = new THREE.CylinderGeometry(0.24, 0.20, 0.65, 16);
    this.avatarMat = new THREE.MeshStandardMaterial({ color: learnerColor, roughness: 0.5 });
    const torso = new THREE.Mesh(torsoGeom, this.avatarMat);
    torso.position.y = 0.75;
    torso.castShadow = true;
    this.avatarGroup.add(torso);

    // Head
    const headGeom = new THREE.SphereGeometry(0.18, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    this.avatarGroup.add(head);

    // 360° Direction Arrow on Floor
    const arrowGeom = new THREE.ConeGeometry(0.22, 0.5, 16);
    arrowGeom.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.position.set(0, 0.05, 0.6);
    this.avatarGroup.add(arrow);

    this.scene.add(this.avatarGroup);
  }

  createInspectionObjects() {
    const bin=this.world.smartBin;
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.55,0.55),new THREE.MeshStandardMaterial({color:0x64748b}));
    body.position.copy(this.to3D(bin.x,bin.y,0.3));
    const lid=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.06,0.6),new THREE.MeshStandardMaterial({color:0x22c55e}));
    lid.name='smart-bin-lid';
    lid.position.copy(this.to3D(bin.x,bin.y,0.61));
    this.binLid=lid;
    this.scene.add(body,lid);
    const table=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.15,0.6),new THREE.MeshStandardMaterial({color:0xa16207}));
    table.position.copy(this.to3D(this.world.depositTable.x,this.world.depositTable.y,0.4));
    this.scene.add(table);

    this.inspectionObjects = this.world.inspectionTags.map(tag => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      marker.position.copy(this.to3D(tag.x, tag.y, 0.65));
      marker.userData.tag = tag;
      const label = this.createWorldLabel(tag.text);
      label.position.copy(this.to3D(tag.x, tag.y, 1.05));
      label.visible = false;
      this.scene.add(marker, label);
      return { tag, marker, label };
    });
    this.scatteredObjects = this.world.objects.map(object => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.25), new THREE.MeshStandardMaterial({ color: object.type === 'TRASH' ? 0xf43f5e : 0x10b981 }));
      const label = this.createStationBillboard(object.icon, object.name, 0x38bdf8);
      label.scale.set(1.4, 0.44, 1);
      this.scene.add(mesh, label);
      return { object, mesh, label };
    });
  }

  createWorldLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(255,255,255,0.96)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '30px sans-serif';
    context.fillStyle = '#854d0e';
    context.textAlign = 'center';
    context.fillText(text, 1024, 58, 2000);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }));
    label.scale.set(7.5, 0.35, 1);
    return label;
  }

  inspectTag(tag) {
    this.selectedTag = tag;
    appState.recordHotspot?.(tag.id, this.viewMode === 'fps' ? 'fps' : '3d');
  }

  updateInspectionObjects() {
    if(this.binLid)this.binLid.rotation.x=this.world.smartBin.isOpen?-Math.PI/2:0;
    const avatar = this.world.avatar;
    const nearby = this.world.inspectionTags.find(tag => Math.hypot(avatar.x - tag.x, avatar.y - tag.y) < 65);
    if (['3d', 'fps'].includes(window.currentViewMode) && nearby && nearby !== this.nearbyTag) this.inspectTag(nearby);
    this.nearbyTag = nearby;
    for (const { tag, marker, label } of this.inspectionObjects) {
      marker.visible = this.viewMode !== 'robot';
      label.visible = this.viewMode !== 'robot' && (tag === nearby || tag === this.selectedTag);
    }
    for (const { object, mesh, label } of this.scatteredObjects) {
      mesh.visible = label.visible = !object.disposed;
      mesh.position.copy(this.to3D(object.x, object.y, object.carried ? 0.55 : 0.18));
      label.position.copy(this.to3D(object.x, object.y, 0.6));
      label.visible = !object.disposed && this.viewMode !== 'robot';
    }
  }

  createFloorDecals() {
    this.dirtDecals = [];
    this.wetDecals = [];

    // Dirt spots
    const dirtGeom = new THREE.CircleGeometry(0.28, 16);
    dirtGeom.rotateX(-Math.PI / 2);
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });

    this.world.dirtCells.forEach(d => {
      const pos = this.to3D(d.x, d.y, 0.11);
      const mesh = new THREE.Mesh(dirtGeom, dirtMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.dirtDecals.push({ cell: d, mesh });
    });

    // Wet spills
    const wetGeom = new THREE.CircleGeometry(0.48, 24);
    wetGeom.rotateX(-Math.PI / 2);
    const wetMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.3
    });

    this.world.wetCells.forEach(w => {
      const pos = this.to3D(w.x, w.y, 0.115);
      const mesh = new THREE.Mesh(wetGeom, wetMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.wetDecals.push({ cell: w, mesh });
    });
  }

  // -------------------------------------------------------------
  // 5. INTERACTIVE 360° RAYCASTING & CLICK CONTROLS
  // -------------------------------------------------------------
  bindEvents() {
    window.addEventListener('resize', () => this.onResize());

    // Mouse Move (Raycasting for Station Hover & 360° FPS view)
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.viewMode === 'robot') return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.viewMode === 'fps' && this.isMouseDown) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.fpsYaw -= dx * 0.004;
        this.fpsPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.fpsPitch - dy * 0.004));
        this.prevMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      this.checkStationHover();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    // Mouse Click (Raycast Station click or floor click to move avatar)
    this.canvas.addEventListener('click', (e) => {
      if (this.viewMode === 'robot') return;

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const hit = this.raycaster.intersectObjects(this.inspectionObjects.map(item => item.marker), false)[0];
      if (hit) {
        this.inspectTag(hit.object.userData.tag);
        return;
      }
      if (this.viewMode === 'fps') return;

      // 1. Check Station Ring Click
      const intersects = this.raycaster.intersectObjects(
        this.stationObjects.map(s => s.ringMesh).concat(this.stationObjects.map(s => s.colMesh)),
        false
      );

      if (intersects.length > 0) {
        const parent = intersects[0].object.parent;
        if (parent && parent.userData.step) {
          (window.navigateStep || window.openStepModal)?.(parent.userData.step);
          return;
        }
      }

      // 2. Check Click on Floor to Move Operator Avatar
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(groundPlane, targetPoint)) {
        const { x, y } = this.to2D(targetPoint.x, targetPoint.z);
        this.world.avatar.targetX = x;
        this.world.avatar.targetY = y;
      }
    });

    // Keyboard inputs for FPS Walkthrough Mode
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const modal = document.getElementById('stepModalOverlay');
      if (modal && modal.style.display !== 'none') return;

      if (this.viewMode === 'robot') return;
      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(e.key)) this.keys[e.key] = true;
      if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(e.key)) this.keys[e.key] = false;
      if (this.keys.hasOwnProperty(k)) this.keys[k] = false;
    });
  }

  checkStationHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.stationObjects.map(s => s.ringMesh).concat(this.stationObjects.map(s => s.colMesh)),
      false
    );

    if (intersects.length > 0) {
      const parent = intersects[0].object.parent;
      if (parent && parent.userData.step) {
        this.hoveredStation = parent.userData.step;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    this.hoveredStation = null;
    this.canvas.style.cursor = 'default';
  }

  onResize() {
    if (!this.canvas) return;
    const w = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const h = this.canvas.parentElement?.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // -------------------------------------------------------------
  // 6. 360-DEGREE VIEW MODES & HEADING CONTROL
  // -------------------------------------------------------------
  setViewMode(mode) {
    this.cameraAnimationId = (this.cameraAnimationId || 0) + 1;
    this.viewMode = mode;
    this.updateViewPresentation();

    if (mode === 'orbit') {
      this.controls.enabled = true;
      this.controls.autoRotate = false;
      this.animateCameraTo(new THREE.Vector3(4, 14, 18), new THREE.Vector3(3.5, 0.5, 0));
    } else if (mode === 'robot') {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
      this.isAutoSpinning = false;
      this.camera.near = 0.03;
      this.camera.updateProjectionMatrix();
      if (this.robotGroup) this.robotGroup.visible = false;
      this.updateRobotCamera();
    } else if (mode === 'fps') {
      this.controls.enabled = false;
      const avatarPos = this.to3D(this.world.avatar.x, this.world.avatar.y, 1.65);
      this.camera.position.copy(avatarPos);
      this.fpsYaw = Math.atan2(Math.cos(this.world.avatar.heading), Math.sin(this.world.avatar.heading));
      this.fpsPitch = 0;
    } else if (mode === 'topDown') {
      this.controls.enabled = true;
      this.animateCameraTo(new THREE.Vector3(3.5, 22, 0.1), new THREE.Vector3(3.5, 0, 0));
    }
  }

  updateViewPresentation() {
    const firstPerson = this.viewMode === 'fps' || this.viewMode === 'robot';
    const fov = firstPerson ? 78 : 48;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.avatarGroup) this.avatarGroup.visible = this.viewMode !== 'fps';
    this.camera.updateMatrixWorld();
    const resizeLabel = (sprite, width, height, maxPixels) => {
      if (!sprite) return;
      let scale = 1;
      if (firstPerson) {
        const position = sprite.getWorldPosition(new THREE.Vector3());
        const distance = Math.max(0.01, -position.applyMatrix4(this.camera.matrixWorldInverse).z);
        const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov/2));
        scale = Math.min(1, maxPixels * visibleHeight / (Math.max(1,this.canvas.clientHeight) * width));
      }
      sprite.scale.set(width*scale,height*scale,1);
    };
    for (const station of this.stationObjects) {
      station.colMesh.visible = !firstPerson;
      resizeLabel(station.sprite,2.4,0.75,120);
    }
    resizeLabel(this.robotActionSprite,2.6,0.65,160);
  }

  captureViewState() {
    return {
      viewMode: this.viewMode, position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(), near: this.camera.near,
      target: this.controls.target.clone(), enabled: this.controls.enabled,
      autoRotate: this.controls.autoRotate, isAutoSpinning: this.isAutoSpinning,
      isFollowingRobot: this.isFollowingRobot, fpsYaw: this.fpsYaw, fpsPitch: this.fpsPitch,
      robotVisible: this.robotGroup?.visible
    };
  }

  restoreViewState(saved) {
    this.cameraAnimationId = (this.cameraAnimationId || 0) + 1;
    this.viewMode = saved.viewMode;
    this.camera.position.copy(saved.position);
    this.camera.quaternion.copy(saved.quaternion);
    this.camera.near = saved.near;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(saved.target);
    this.controls.enabled = saved.enabled;
    this.controls.autoRotate = saved.autoRotate;
    this.isAutoSpinning = saved.isAutoSpinning;
    this.isFollowingRobot = saved.isFollowingRobot;
    this.fpsYaw = saved.fpsYaw;
    this.fpsPitch = saved.fpsPitch;
    if (this.robotGroup) this.robotGroup.visible = saved.robotVisible;
    this.updateViewPresentation();
  }

  updateRobotCamera() {
    const pose = getRobotCameraPose(this.world.robot, (x, y, height) => this.to3D(x, y, height));
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
  }

  setHeading(angleDegrees) {
    if (this.viewMode === 'robot') return;
    if (!this.controls) return;
    const rad = (angleDegrees * Math.PI) / 180;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const polar = this.controls.getPolarAngle();

    // Position camera along spherical coordinates with specified azimuth
    const cx = this.controls.target.x + dist * Math.sin(polar) * Math.sin(rad);
    const cz = this.controls.target.z + dist * Math.sin(polar) * Math.cos(rad);
    const cy = this.controls.target.y + dist * Math.cos(polar);

    this.animateCameraTo(new THREE.Vector3(cx, cy, cz), this.controls.target);
  }

  toggleAutoSpin() {
    if (this.viewMode === 'robot') return false;
    this.isAutoSpinning = !this.isAutoSpinning;
    if (this.controls) {
      this.controls.autoRotate = this.isAutoSpinning;
      this.controls.autoRotateSpeed = 1.8;
    }
    return this.isAutoSpinning;
  }

  focusRobot() {
    if (this.viewMode === 'robot') return;
    if (!this.world.robot || !this.controls) return;
    const r = this.world.robot;
    const robot3D = this.to3D(r.x, r.y, 0.24);
    const targetCameraPos = new THREE.Vector3(robot3D.x, 7.0, robot3D.z + 5.5);
    this.animateCameraTo(targetCameraPos, robot3D, 550);
  }

  toggleFollowRobot() {
    this.isFollowingRobot = !this.isFollowingRobot;
    if (this.isFollowingRobot) {
      this.focusRobot();
    }
    return this.isFollowingRobot;
  }

  animateCameraTo(targetPos, targetLookAt, duration = 650) {
    const animationId = this.cameraAnimationId = (this.cameraAnimationId || 0) + 1;
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();

    const anim = (now) => {
      if (this.cameraAnimationId !== animationId || this.viewMode === 'robot') return;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 0.5 - Math.cos(t * Math.PI) / 2; // smooth easeInOut

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
      this.controls.update();

      if (t < 1) {
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
  }

  // -------------------------------------------------------------
  // 7. REAL-TIME TICK LOOP & ANIMATION
  // -------------------------------------------------------------
  startLoop() {
    let lastTime = performance.now();

    const loop = (now) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      this.update(delta);
      this.renderer.render(this.scene, this.camera);
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  update(delta) {
    // 1. Sync Cleaning Robot Position & Active State
    if (this.robotGroup && this.world.robot) {
      const r = this.world.robot;
      const targetPos = this.to3D(r.x, r.y, 0.24);
      this.robotGroup.position.lerp(targetPos, 0.35);

      // Invert 2D heading for 3D Y-axis rotation
      this.robotGroup.rotation.y = -r.heading + Math.PI / 2;

      // Spin lidar scanner dome
      if (this.robotLidarTurret) {
        this.robotLidarTurret.rotation.y += 0.12;
      }

      // Pulse ground beacon ring & vertical beam
      if (this.robotGroundBeacon) {
        const pulse = 1.0 + Math.sin(performance.now() * 0.005) * 0.15;
        this.robotGroundBeacon.scale.set(pulse, 1, pulse);
        if (this.robotBeamMat) {
          this.robotBeamMat.opacity = 0.20 + Math.sin(performance.now() * 0.004) * 0.08;
        }
      }

      // Dynamically update LED ring & ground halo & beam colors
      if (this.robotLedMat) {
        const rgb = r.ledColor.match(/[\d.]+/g)?.slice(0,3).map(Number) || [59,130,246];
        const col = (rgb[0]<<16) | (rgb[1]<<8) | rgb[2];

        this.robotLedMat.color.setHex(col);
        this.robotLedMat.emissive.setHex(col);
        if (this.robotGroundMat) this.robotGroundMat.color.setHex(col);
        if (this.robotBeamMat) this.robotBeamMat.color.setHex(col);
      }

      // Update Overhead Action Sprite
      const act = r.traceState?.action || (r.vacuumActive ? 'VACUUM ON' : r.mopDeployed ? 'MOPPING' : 'READY / CRUISING');
      this.updateRobotActionSprite(`⚙️ ${act} • 🔋 ${Math.round(r.battery)}%`);

      // Follow Camera Mode: keep camera tracking the robot
      if (this.isFollowingRobot && this.controls && this.viewMode === 'orbit') {
        const deltaTarget = targetPos.clone().sub(this.controls.target).multiplyScalar(0.08);
        this.camera.position.add(deltaTarget);
        this.controls.target.add(deltaTarget);
      }
    }

    // 2. Sync Roaming Cat NPC (Elevation sitting on top of floor)
    if (this.catGroup && this.world.cat) {
      const c = this.world.cat;
      const catPos = this.to3D(c.x, c.y, 0.22);
      this.catGroup.position.lerp(catPos, 0.25);
      this.catGroup.rotation.y = -c.heading + Math.PI / 2;
    }

    // 3. Sync Operator Avatar Position (Feet touching floor at 0.10)
    if (this.avatarGroup && this.world.avatar) {
      const a = this.world.avatar;
      const avatarPos = this.to3D(a.x, a.y, 0.10);
      this.avatarGroup.position.lerp(avatarPos, 0.3);
      this.avatarGroup.rotation.y = -a.heading + Math.PI / 2;
    }

    // 4. Update Floor Decals (Dirt & Spills)
    this.dirtDecals.forEach(d => {
      d.mesh.visible = !d.cell.cleaned;
    });
    this.wetDecals.forEach(w => {
      w.mesh.visible = !w.cell.cleaned;
    });

    // 5. Holographic Station Rings Pulsing Animation
    const time = performance.now() * 0.003;
    this.stationObjects.forEach(st => {
      st.ringMesh.rotation.z += 0.015;
      const isCurrent = appState.currentStep === st.def.step;
      const isHover = this.hoveredStation === st.def.step;
      const baseScale = isHover ? 1.25 : isCurrent ? 1.1 : 1.0;
      const pulse = baseScale + Math.sin(time + st.def.step) * 0.06;
      st.ringMesh.scale.set(pulse, pulse, pulse);
    });

    // 6. Avatar Locomotion Update (Camera-Relative Screen Space & Wall Sliding)
    if (this.viewMode === 'robot') {
      this.updateRobotCamera();
    } else if (this.viewMode === 'fps') {
      this.updateFpsLocomotion(delta);
    } else {
      this.controls.update();
      this.updateOrbitLocomotion(delta);
    }

    this.updateInspectionObjects();
    this.updateViewPresentation();

    // 7. Synchronize 360° Compass Widget
    this.updateCompassHud();
  }

  /**
   * 3D Orbit Mode: Locomotion is strictly relative to the 3D camera view.
   * Up/W ALWAYS moves into the scene (away from camera / screen-up).
   * Down/S ALWAYS moves toward the camera (screen-down).
   * Left/A ALWAYS moves to the left of the screen.
   * Right/D ALWAYS moves to the right of the screen.
   * Wall sliding is applied so the avatar never gets stuck on obstacles or corners.
   */
  updateOrbitLocomotion(delta) {
    const avatar = this.world.avatar;
    let inputForward = 0;
    let inputRight = 0;

    if (this.keys.w || this.keys.W || this.keys.ArrowUp) inputForward += 1;
    if (this.keys.s || this.keys.S || this.keys.ArrowDown) inputForward -= 1;
    if (this.keys.d || this.keys.D || this.keys.ArrowRight) inputRight += 1;
    if (this.keys.a || this.keys.A || this.keys.ArrowLeft) inputRight -= 1;

    if (inputForward === 0 && inputRight === 0) {
      if (!avatar.targetX && !avatar.targetY) {
        avatar.moving = false;
      }
      return;
    }

    avatar.targetX = null;
    avatar.targetY = null;

    // Camera horizontal forward and right vectors
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // 3D movement vector on ground plane
    const move3D = new THREE.Vector3()
      .addScaledVector(forward, inputForward)
      .addScaledVector(right, inputRight)
      .normalize();

    // Map 3D ground motion to 2D coordinate delta
    const dx2d = move3D.x * (950 / 17.5);
    const dy2d = move3D.z * (920 / 15.0);

    const len = Math.hypot(dx2d, dy2d);
    if (len > 0) {
      const step = avatar.speed * (delta ? Math.min(delta * 60, 2.0) : 1.0);
      const ndx = (dx2d / len) * step;
      const ndy = (dy2d / len) * step;

      const res = this.world.resolveMove(avatar.x, avatar.y, ndx, ndy, avatar.radius);
      if (res.moved) {
        avatar.x = res.x;
        avatar.y = res.y;
        avatar.heading = Math.atan2(ndy, ndx);
        avatar.moving = true;
      }
    }
  }

  /**
   * First-Person Walkthrough Mode: Locomotion with smooth wall sliding.
   */
  updateFpsLocomotion(delta) {
    const avatar = this.world.avatar;
    const step = avatar.speed * (delta ? Math.min(delta * 60, 2.0) : 1.0);

    let moveX = 0;
    let moveZ = 0;

    if (this.keys.w || this.keys.W || this.keys.ArrowUp) moveZ += 1;
    if (this.keys.s || this.keys.S || this.keys.ArrowDown) moveZ -= 1;
    if (this.keys.a || this.keys.A || this.keys.ArrowLeft) moveX -= 1;
    if (this.keys.d || this.keys.D || this.keys.ArrowRight) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const forward = new THREE.Vector3(Math.sin(this.fpsYaw), 0, Math.cos(this.fpsYaw));
      const right = new THREE.Vector3(-Math.cos(this.fpsYaw), 0, Math.sin(this.fpsYaw));

      const dir = new THREE.Vector3()
        .addScaledVector(forward, moveZ)
        .addScaledVector(right, moveX)
        .normalize();

      const dx2d = dir.x * (950 / 17.5);
      const dy2d = dir.z * (920 / 15.0);
      const len = Math.hypot(dx2d, dy2d);
      if (len > 0) {
        const ndx = (dx2d / len) * step;
        const ndy = (dy2d / len) * step;

        const res = this.world.resolveMove(avatar.x, avatar.y, ndx, ndy, avatar.radius);
        if (res.moved) {
          avatar.x = res.x;
          avatar.y = res.y;
          avatar.heading = Math.atan2(ndy, ndx);
          avatar.moving = true;
        }
      }
    } else {
      avatar.moving = false;
    }

    // Follow avatar eye level
    const avatarPos = this.to3D(avatar.x, avatar.y, 1.65);
    this.camera.position.copy(avatarPos);

    // Camera look direction from yaw and pitch
    const lookDir = new THREE.Vector3(
      Math.sin(this.fpsYaw) * Math.cos(this.fpsPitch),
      Math.sin(this.fpsPitch),
      Math.cos(this.fpsYaw) * Math.cos(this.fpsPitch)
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  updateCompassHud() {
    const needle = document.getElementById('compassNeedle');
    const readout = document.getElementById('compassReadout');
    if (!needle && !readout) return;

    let deg = 0;
    if (this.viewMode === 'robot') {
      deg = Math.round(((this.world.robot.heading * 180 / Math.PI % 360) + 360) % 360) % 360;
    } else if (this.viewMode === 'fps') {
      deg = Math.round(((this.fpsYaw * 180) / Math.PI) % 360 + 360) % 360;
    } else if (this.controls) {
      const az = this.controls.getAzimuthalAngle();
      deg = Math.round(((az * 180) / Math.PI) % 360 + 360) % 360;
    }

    if (needle) {
      needle.style.transform = `rotate(${-deg}deg)`;
    }
    if (readout) {
      let card = 'N';
      if (deg >= 23 && deg < 68) card = 'NE';
      else if (deg >= 68 && deg < 113) card = 'E';
      else if (deg >= 113 && deg < 158) card = 'SE';
      else if (deg >= 158 && deg < 203) card = 'S';
      else if (deg >= 203 && deg < 248) card = 'SW';
      else if (deg >= 248 && deg < 293) card = 'W';
      else if (deg >= 293 && deg < 338) card = 'NW';
      readout.innerText = `🧭 ${deg}° ${card}`;
    }
  }

  dispose() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.renderer) this.renderer.dispose();
  }
}
