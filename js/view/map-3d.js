import { translate, onLanguageChange } from '../i18n.js';
/**
 * CollabPEAS - 3D 360-Degree Interactive Apartment Map Engine
 * Powered by Three.js WebGL and Materials/Apartment.glb.
 * Features 360° OrbitControls, First-Person 360° Walkthrough,
 * Physical household objects, a cleaning robot, a roaming cat and operator,
 * floor cleaning targets, and optional Environment observation labels.
 */

import * as THREE from '../../lib/three/three.module.js';
import { GLTFLoader } from '../../lib/three/GLTFLoader.js';
import { OrbitControls } from '../../lib/three/OrbitControls.js';
import { appState } from '../state.js';
import { getRobotCameraPose } from './pov-renderer.js';
import { apartmentCollision } from '../sim/apartment-collision-data.js';
import { applyApartmentLayout } from './apartment-model-layout.js';
const objectLabel = object => object.type==='CUP'?'Mug':object.type==='FOOD'?'Food bowl':object.id==='TRASH_1'?'Paper':'Can';

export class Apartment3DMap {
  constructor(canvasElement, world) {
    this.canvas = canvasElement;
    this.world = world;

    // View Modes: 'orbit' | 'fps' | 'thirdPerson' (player walkthrough) | 'robot' | 'topDown'
    this.viewMode = 'orbit';
    this.isAutoSpinning = false;
    this.modelLoaded = false;

    // First-person walkthrough camera state
    this.fpsPitch = 0;
    this.fpsYaw = 0;
    this.isMouseDown = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    this.environmentObservation = false;
    this.environmentLabels = [];

    // Raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initScene();
    this.initLighting();
    this.initControls();
    this.initEntities();
    this.createInspectionObjects();
    this.createEnvironmentLabels();
    this.loadApartmentModel();
    this.bindEvents();
    this.startLoop();
    onLanguageChange(() => {
      this.scene.traverse(object => object.userData.repaintLabel?.());
    });
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
          gltf.scene.getObjectByName('Robotic_Lawn_Mower_Station_spec_02')?.removeFromParent();
          this.apartmentModel = applyApartmentLayout(gltf.scene);
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
    this.create3DRobot();
    this.create3DCat();
    this.create3DAvatar();
    this.createFloorDecals();
  }

  create3DRobot() {
    this.robotGroup = new THREE.Group();

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

    // Immediately position the robot group at world coordinates
    const initPos = this.to3D(this.world.robot.x, this.world.robot.y, 0.24);
    this.robotGroup.position.copy(initPos);
    this.robotGroup.rotation.y = -this.world.robot.heading + Math.PI / 2;

    this.scene.add(this.robotGroup);
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

    this.scene.add(this.avatarGroup);
  }

  createInspectionObjects() {
    this.chargingDock=new THREE.Group();
    const dockMaterial=new THREE.MeshStandardMaterial({color:0x5d6876,roughness:.65});
    const back=new THREE.Mesh(new THREE.BoxGeometry(.55,.38,.08),dockMaterial);back.position.set(0,.19,-.16);
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.55,.025,.35),dockMaterial);pad.position.y=.012;
    const contacts=new THREE.Mesh(new THREE.BoxGeometry(.2,.035,.1),new THREE.MeshStandardMaterial({color:0xcbd5e1,metalness:.7}));contacts.position.set(0,.035,-.05);
    this.chargingDock.add(back,pad,contacts);this.chargingDock.position.copy(this.to3D(this.world.dock.x,this.world.dock.y,.11));
    this.scene.add(this.chargingDock);
    this.scatteredObjects=this.world.objects.map(object=>{
      const kind=objectLabel(object),mesh=new THREE.Group();
      const material=color=>new THREE.MeshStandardMaterial({color,roughness:.6});
      if(kind==='Paper') {
        const rim=[[-.17,.005,-.11],[-.04,.035,-.16],[.14,.015,-.09],[.17,.03,.09],[0,.005,.15],[-.14,.03,.1]],vertices=[];
        rim.forEach((point,i)=>vertices.push(0,.065,0,...point,...rim[(i+1)%rim.length]));
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
        mesh.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xf2eee4,roughness:.95,side:THREE.DoubleSide,flatShading:true})));
        const creases=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...rim[0]),new THREE.Vector3(0,.067,0),new THREE.Vector3(...rim[3])]);
        mesh.add(new THREE.Line(creases,new THREE.LineBasicMaterial({color:0xada89f})));
      } else if(kind==='Can') {
        const body=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.25,20),material(0xe05d50));body.position.y=.13;
        const cap=new THREE.Mesh(new THREE.CylinderGeometry(.092,.092,.012,20),material(0xcbd5e1));cap.position.y=.26;
        const tab=new THREE.Mesh(new THREE.BoxGeometry(.055,.012,.025),material(0x66717c));tab.position.y=.272;
        mesh.add(body,cap,tab);
      } else if(kind==='Mug') {
        const points=[[0,0],[.1,0],[.12,.035],[.12,.22],[.095,.22],[.095,.045],[0,.045]].map(([x,y])=>new THREE.Vector2(x,y));
        mesh.add(new THREE.Mesh(new THREE.LatheGeometry(points,24),material(0xf2f4ef)));
        const handle=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,8,20),material(0xf2f4ef));handle.position.set(.13,.12,0);mesh.add(handle);
      } else {
        const points=[[0,0],[.12,0],[.17,.1],[.145,.1],[.105,.025],[0,.025]].map(([x,y])=>new THREE.Vector2(x,y));
        mesh.add(new THREE.Mesh(new THREE.LatheGeometry(points,24),material(0x4c91bd)));
        const food=new THREE.Mesh(new THREE.CylinderGeometry(.115,.105,.025,18),material(0x84603d));food.position.y=.05;mesh.add(food);
      }
      mesh.traverse(child=>{if(child.isMesh)child.castShadow=true;});
      mesh.position.copy(this.to3D(object.x,object.y,.12));this.scene.add(mesh);
      return {object,mesh,kind};
    });
  }

  createWorldLabel(text) {
    const canvas=document.createElement('canvas');canvas.height=64;
    const context=canvas.getContext('2d');
    context.font='bold 30px -apple-system, BlinkMacSystemFont, sans-serif';
    const captions=[text,`✓ ${text}`,translate(text,'zh-CN'),`✓ ${translate(text,'zh-CN')}`];
    // Uploaded WebGL texture storage keeps the same dimensions across repaints.
    canvas.width=Math.ceil(Math.max(...captions.map(caption=>context.measureText(caption).width))+28);
    let observed=false;
    const paint=()=>{
      context.font='bold 30px -apple-system, BlinkMacSystemFont, sans-serif';
      const caption=(observed?'✓ ':'')+translate(text);
      context.clearRect(0,0,canvas.width,canvas.height);
      context.fillStyle=observed?'#dcfce7':'rgba(255,255,255,.96)';context.strokeStyle=observed?'#16a34a':'#71879c';context.lineWidth=2;
      context.beginPath();context.roundRect(2,2,canvas.width-4,60,12);context.fill();context.stroke();
      context.font='bold 30px -apple-system, BlinkMacSystemFont, sans-serif';context.fillStyle=observed?'#166534':'#263c4c';context.textAlign='center';
      context.fillText(caption,canvas.width/2,43);
    };
    paint();
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false,toneMapped:false,transparent:true}));
    label.userData.environmentLabel=text;label.userData.aspect=canvas.width/canvas.height;label.userData.observed=false;
    label.userData.repaintLabel=()=>{paint();label.userData.aspect=canvas.width/canvas.height;texture.needsUpdate=true;};
    label.userData.setObserved=value=>{const next=Boolean(value);if(next===observed)return;observed=next;label.userData.observed=next;label.userData.repaintLabel();};
    return label;
  }

  createEnvironmentLabels() {
    const items=[
      ...this.world.dirtCells.map(entity=>({entity,kind:'dirt',text:'Dirt',height:.45})),
      ...this.world.wetCells.map(entity=>({entity,kind:'spill',text:'Spill',height:.45})),
      ...this.world.objects.map(entity=>({entity,kind:'object',text:objectLabel(entity),height:.55})),
      {entity:this.world.dock,kind:'dock',text:'Charging dock',height:.65},
      {entity:this.world.cat,kind:'cat',text:'Cat',height:.85},
      {entity:this.world.avatar,kind:'person',text:'Person',height:1.8}
    ];
    this.environmentLabels=items.map(item=>{const label=this.createWorldLabel(item.text),targetId=item.entity.id||{dock:'DOCK',cat:'CAT',person:'PERSON'}[item.kind];label.userData.environmentTarget=targetId;this.scene.add(label);return {...item,targetId,label};});
    this.updateEnvironmentLabels();
  }

  setEnvironmentObservation(active) {
    this.environmentObservation=Boolean(active);
    this.updateEnvironmentLabels();
  }

  updateEnvironmentLabels() {
    const visible=this.environmentObservation&&this.viewMode!=='robot'&&!appState.isRobotPovActive;
    for(const {entity,kind,targetId,label,height} of this.environmentLabels||[]) {
      label.userData.setObserved?.(appState.observedEnvironmentTargets?.has(targetId));
      label.position.copy(this.to3D(entity.x,entity.y,height));
      label.visible=Boolean(visible&&!((kind==='dirt'||kind==='spill')&&entity.cleaned)&&!(kind==='object'&&(entity.carried||entity.disposed||entity.sorted)));
    }
  }

  updateInspectionObjects() {
    for(const {object,mesh} of this.scatteredObjects||[]) {
      mesh.visible=!object.disposed&&!object.sorted;
      mesh.position.copy(this.to3D(object.x,object.y,object.carried?.55:.12));
    }
    this.updateEnvironmentLabels();
  }

  createFloorDecals() {
    this.dirtDecals=[];this.wetDecals=[];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const context=canvas.getContext('2d');context.clearRect(0,0,256,256);
    for(let i=0;i<64;i++) {
      const seed=Math.sin((i+1)*127.1)*43758.5453;
      const angle=i*2.39996,distance=Math.sqrt(seed-Math.floor(seed))*106;
      context.fillStyle=['#e5dac5','#c5bcae','#807b73'][i%3];
      context.beginPath();context.ellipse(128+Math.cos(angle)*distance,128+Math.sin(angle)*distance,2+i%5,1+i%3,angle,0,Math.PI*2);context.fill();
    }
    const dustTexture=new THREE.CanvasTexture(canvas);dustTexture.colorSpace=THREE.SRGBColorSpace;
    const dirtGeometry=new THREE.PlaneGeometry(.65,.58);dirtGeometry.rotateX(-Math.PI/2);
    const dirtMaterial=new THREE.MeshBasicMaterial({map:dustTexture,transparent:true,alphaTest:.04,depthWrite:false});
    for(const cell of this.world.dirtCells) {
      const mesh=new THREE.Mesh(dirtGeometry,dirtMaterial);mesh.position.copy(this.to3D(cell.x,cell.y,.115));mesh.scale.setScalar(cell.radius/12);
      this.scene.add(mesh);this.dirtDecals.push({cell,mesh});
    }
    const outline=[[.42,0],[.35,.22],[.12,.32],[-.12,.26],[-.38,.16],[-.45,-.08],[-.16,-.27],[.12,-.3],[.36,-.15]];
    const shape=new THREE.Shape();shape.moveTo((outline.at(-1)[0]+outline[0][0])/2,(outline.at(-1)[1]+outline[0][1])/2);
    outline.forEach(([x,y],i)=>{const next=outline[(i+1)%outline.length];shape.quadraticCurveTo(x,y,(x+next[0])/2,(y+next[1])/2);});shape.closePath();
    const waterGeometry=new THREE.ShapeGeometry(shape);waterGeometry.rotateX(-Math.PI/2);
    const waterMaterial=new THREE.MeshStandardMaterial({color:0x25bad4,transparent:true,opacity:.72,roughness:.12,metalness:.12,depthWrite:false});
    const glintGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.22,.006,-.06),new THREE.Vector3(-.11,.006,-.12),new THREE.Vector3(.03,.006,-.13)]);
    const glintMaterial=new THREE.LineBasicMaterial({color:0xe7fcff,transparent:true,opacity:.95});
    for(const cell of this.world.wetCells) {
      const mesh=new THREE.Group();mesh.add(new THREE.Mesh(waterGeometry,waterMaterial),new THREE.Line(glintGeometry,glintMaterial));
      mesh.position.copy(this.to3D(cell.x,cell.y,.12));mesh.scale.setScalar(cell.radius/24);
      this.scene.add(mesh);this.wetDecals.push({cell,mesh});
    }
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

      if ((this.viewMode === 'fps' || this.viewMode === 'thirdPerson') && this.isMouseDown) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.fpsYaw -= dx * 0.004;
        this.fpsPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.fpsPitch - dy * 0.004));
        this.prevMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

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
      if (this.viewMode === 'robot' || this.viewMode === 'thirdPerson') return;

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.viewMode === 'fps') return;

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
      if (modal && modal.style.display !== 'none' &&
          !(modal.classList.contains('workstation-layout') && e.target === this.canvas)) return;

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
    const previousMode = this.viewMode;
    this.cameraAnimationId = (this.cameraAnimationId || 0) + 1;
    this.viewMode = mode;
    this.updateViewPresentation();

    if (mode === 'orbit') {
      this.controls.enabled = true;
      this.controls.autoRotate = false;
      this.controls.maxDistance = 35;
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
    } else if (mode === 'thirdPerson') {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
      this.isFollowingRobot = false;
      this.isAutoSpinning = false;
      this.camera.near = .1;
      this.camera.updateProjectionMatrix();
      if (previousMode !== 'fps' && previousMode !== 'thirdPerson') {
        this.fpsYaw = Math.atan2(Math.cos(this.world.avatar.heading), Math.sin(this.world.avatar.heading));
        this.fpsPitch = 0;
      }
      this.updateThirdPersonCamera();
    } else if (mode === 'topDown') {
      this.controls.enabled = true;
      this.animateCameraTo(new THREE.Vector3(3.5, 22, 0.1), new THREE.Vector3(3.5, 0, 0));
    }
  }

  viewWholeApartment() {
    if(this.viewMode==='robot')return;
    this.cameraAnimationId=(this.cameraAnimationId||0)+1;
    const bounds=this.apartmentModel?new THREE.Box3().setFromObject(this.apartmentModel):new THREE.Box3();
    if(bounds.isEmpty())for(const [x,y,x1,y1] of apartmentCollision.floors) {
      bounds.expandByPoint(this.to3D(x,y,0));bounds.expandByPoint(this.to3D(x1,y1,3.2));
    }
    const center=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(0,1,.18).normalize();
    this.viewMode='orbit';this.camera.fov=48;this.camera.near=.1;this.camera.updateProjectionMatrix();
    this.camera.position.copy(center).add(direction);this.camera.lookAt(center);
    const inverse=this.camera.quaternion.clone().invert();
    const tangent=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
      const local=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inverse);
      distance=Math.max(distance,local.z+Math.max(Math.abs(local.x)/(tangent*this.camera.aspect),Math.abs(local.y)/tangent)*1.15);
    }
    this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.lookAt(center);
    this.controls.target.copy(center);this.controls.enabled=true;this.controls.autoRotate=false;
    this.controls.maxDistance=Math.max(35,distance*1.05);this.controls.update();
    this.isFollowingRobot=false;this.isAutoSpinning=false;this.updateViewPresentation();
  }

  updateViewPresentation() {
    const firstPerson=this.viewMode==='fps'||this.viewMode==='robot';
    const fov=firstPerson?78:this.viewMode==='thirdPerson'?68:48;
    if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    if(this.avatarGroup)this.avatarGroup.visible=this.viewMode!=='fps';
    this.updateEnvironmentLabels();
    this.camera.updateMatrixWorld();
    for(const {label} of this.environmentLabels||[]) {
      if(!label.visible)continue;
      const position=label.getWorldPosition(new THREE.Vector3());
      const distance=Math.max(.01,-position.applyMatrix4(this.camera.matrixWorldInverse).z);
      const height=26*2*distance*Math.tan(THREE.MathUtils.degToRad(fov/2))/Math.max(1,this.canvas.clientHeight);
      label.scale.set(height*(label.userData.aspect||2),height,1);
    }
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

  updateThirdPersonCamera() {
    const avatar=this.world.avatar,pivot=this.to3D(avatar.x,avatar.y,1.1);
    if(this.apartmentModel)this.apartmentModel.updateMatrixWorld(true);
    const clearBoom=direction=>{
      let distance=direction.length();direction.normalize();
      if(this.apartmentModel) {
        const ray=this.cameraBoomRay||(this.cameraBoomRay=new THREE.Raycaster());
        ray.set(pivot,direction);ray.near=0;ray.far=distance;
        const hit=ray.intersectObject(this.apartmentModel,true)[0];
        if(hit)distance=Math.max(0,hit.distance-.18);
      }
      return {direction,distance};
    };
    let boom=clearBoom(new THREE.Vector3(-Math.sin(this.fpsYaw)*3,1.1-Math.sin(this.fpsPitch)*1.8,-Math.cos(this.fpsYaw)*3));
    if(boom.distance<1.5) {
      const higher=clearBoom(new THREE.Vector3(-Math.sin(this.fpsYaw)*.25,1.6,-Math.cos(this.fpsYaw)*.25));
      if(higher.distance>boom.distance)boom=higher;
    }
    this.camera.position.copy(pivot).addScaledVector(boom.direction,boom.distance);
    this.camera.lookAt(pivot);
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
    if (this.viewMode === 'robot' || this.viewMode === 'thirdPerson') return false;
    this.isAutoSpinning = !this.isAutoSpinning;
    if (this.controls) {
      this.controls.autoRotate = this.isAutoSpinning;
      this.controls.autoRotateSpeed = 1.8;
    }
    return this.isAutoSpinning;
  }

  focusRobot() {
    if (this.viewMode === 'robot' || this.viewMode === 'thirdPerson') return;
    if (!this.world.robot || !this.controls) return;
    const r = this.world.robot;
    const robot3D = this.to3D(r.x, r.y, 0.24);
    const targetCameraPos = new THREE.Vector3(robot3D.x, 7.0, robot3D.z + 5.5);
    this.animateCameraTo(targetCameraPos, robot3D, 550);
  }

  toggleFollowRobot() {
    if (this.viewMode === 'thirdPerson') return false;
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

      // Update the physical status LED.
      // Dynamically update LED ring & ground halo & beam colors
      if (this.robotLedMat) {
        const rgb = r.ledColor.match(/[\d.]+/g)?.slice(0,3).map(Number) || [59,130,246];
        const col = (rgb[0]<<16) | (rgb[1]<<8) | rgb[2];

        this.robotLedMat.color.setHex(col);
        this.robotLedMat.emissive.setHex(col);
      }

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

    // 6. Avatar Locomotion Update (Camera-Relative Screen Space & Wall Sliding)
    if (this.viewMode === 'robot') {
      this.updateRobotCamera();
    } else if (this.viewMode === 'fps' || this.viewMode === 'thirdPerson') {
      this.updateFpsLocomotion(delta);
    } else {
      this.controls.update();
      this.updateOrbitLocomotion(delta);
    }

    const observationMode=this.viewMode==='orbit'?'3d':this.viewMode;
    if(this.environmentObservation&&globalThis.window?.currentViewMode===observationMode)appState.observeEnvironment(this.world,observationMode);
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

    if(this.viewMode==='thirdPerson')this.updateThirdPersonCamera();
    else {
      const avatarPos = this.to3D(avatar.x, avatar.y, 1.65);
      this.camera.position.copy(avatarPos);
      const lookDir = new THREE.Vector3(
        Math.sin(this.fpsYaw) * Math.cos(this.fpsPitch),
        Math.sin(this.fpsPitch),
        Math.cos(this.fpsYaw) * Math.cos(this.fpsPitch)
      );
      this.camera.lookAt(this.camera.position.clone().add(lookDir));
    }

  }

  updateCompassHud() {
    const needle = document.getElementById('compassNeedle');
    const readout = document.getElementById('compassReadout');
    if (!needle && !readout) return;

    let deg = 0;
    if (this.viewMode === 'robot') {
      deg = Math.round(((this.world.robot.heading * 180 / Math.PI % 360) + 360) % 360) % 360;
    } else if (this.viewMode === 'fps' || this.viewMode === 'thirdPerson') {
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
