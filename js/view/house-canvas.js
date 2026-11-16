import { translate } from '../i18n.js';
/**
 * CollabPEAS - High-Fidelity Realistic Apartment Canvas Engine
 * Directly renders Materials/Apartment.png at full native resolution with high-DPI scaling.
 * Features smooth camera pan & zoom, operator locomotion, roaming cat NPC,
 * physical household objects, floor cleaning targets and Environment observation labels.
 */

import { appState } from '../state.js';
import { apartmentCollision } from '../sim/apartment-collision-data.js';
const objectLabel = object => object.type==='CUP'?'Mug':object.type==='FOOD'?'Food bowl':object.id==='TRASH_1'?'Paper':'Can';

export class HouseCanvasRenderer {
  constructor(canvasElement, world) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.world = world;

    // Use a true overhead render in simulation coordinates, never the tilted PNG.
    this.bgImage = null;
    this.bgLoaded = false;
    window.addEventListener('glbModelLoaded', event => {
      if (event.detail?.mapImage) {
        this.bgImage = event.detail.mapImage;
        this.bgLoaded = true;
      }
    });

    // Keyboard state
    this.keys = {
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
      w: false, s: false, a: false, d: false
    };

    // Camera viewport & smooth pan/zoom & 360° heading
    this.camera = { x: 0, y: 0, scale: 0.85 };
    this.headingAngle = 0; // 360-degree rotation angle in radians
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.animFrame = null;
    this.walkCycle = 0;

    this.environmentObservation = false;

    this.initControls();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.startLoop();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(parent.clientWidth * dpr);
      this.canvas.height = Math.round(parent.clientHeight * dpr);
      this.ctx.scale(dpr, dpr);
      this.cssWidth = parent.clientWidth;
      this.cssHeight = parent.clientHeight;
      if (!this.viewFitted) {
        this.fitView();
      }
    }
  }

  fitView() {
    if (!this.cssWidth || !this.cssHeight) return;
    const scaleX = (this.cssWidth * 0.94) / this.world.width;
    const scaleY = (this.cssHeight * 0.94) / this.world.height;
    this.camera.scale = Math.min(scaleX, scaleY);
    this.camera.x = (this.cssWidth - this.world.width * this.camera.scale) / 2;
    this.camera.y = (this.cssHeight - this.world.height * this.camera.scale) / 2;
    this.viewFitted = true;
  }

  zoom(factor, centerX, centerY) {
    const prevScale = this.camera.scale;
    const newScale = Math.max(0.4, Math.min(2.5, prevScale * factor));
    const cx = centerX !== undefined ? centerX : this.cssWidth / 2;
    const cy = centerY !== undefined ? centerY : this.cssHeight / 2;

    this.camera.x = cx - (cx - this.camera.x) * (newScale / prevScale);
    this.camera.y = cy - (cy - this.camera.y) * (newScale / prevScale);
    this.camera.scale = newScale;
  }

  setHeading(angleDegrees) {
    this.headingAngle = (angleDegrees * Math.PI) / 180;
    this.updateCompassHud();
  }

  focusRobot() {
    if (!this.world.robot) return;
    const r = this.world.robot;
    const cx = (this.cssWidth || 1000) / 2;
    const cy = (this.cssHeight || 700) / 2;
    this.camera.scale = Math.max(1.15, this.camera.scale);
    this.camera.x = cx - r.x * this.camera.scale;
    this.camera.y = cy - r.y * this.camera.scale;
  }

  toggleFollowRobot() {
    this.isFollowingRobot = !this.isFollowingRobot;
    if (this.isFollowingRobot) {
      this.focusRobot();
    }
    return this.isFollowingRobot;
  }

  updateCompassHud() {
    const needle = document.getElementById('compassNeedle');
    const readout = document.getElementById('compassReadout');
    if (!needle && !readout) return;

    const deg = Math.round(((this.headingAngle * 180 / Math.PI) % 360 + 360) % 360);
    if (needle) needle.style.transform = `rotate(${-deg}deg)`;
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

  initControls() {
    window.addEventListener('keydown', (e) => {
      if (window.currentViewMode === 'robot') return;
      // Don't intercept keys if focused on text input or if modal is open
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const modal = document.getElementById('stepModalOverlay');
      if (modal && modal.style.display !== 'none' &&
          !(modal.classList.contains('workstation-layout') && e.target === this.canvas)) return;

      // 360° Rotation Keys Q / E
      if (e.key === 'q' || e.key === 'Q') {
        this.headingAngle -= 0.08;
        this.updateCompassHud();
      }
      if (e.key === 'e' || e.key === 'E') {
        this.headingAngle += 0.08;
        this.updateCompassHud();
      }

      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        e.preventDefault();
      }
      if (this.keys.hasOwnProperty(k)) {
        this.keys[k] = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
      if (this.keys.hasOwnProperty(k)) {
        this.keys[k] = false;
      }
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(factor, mouseX, mouseY);
    }, { passive: false });

    // Drag to pan map
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // left button
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
        this.hasDragged = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const nx = e.clientX - this.panStart.x;
        const ny = e.clientY - this.panStart.y;
        if (Math.abs(nx - this.camera.x) > 3 || Math.abs(ny - this.camera.y) > 3) {
          this.hasDragged = true;
        }
        this.camera.x = nx;
        this.camera.y = ny;
      }

      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'default';
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    this.canvas.addEventListener('click', e => {
      if(this.hasDragged||window.currentViewMode==='robot')return;
      const {x,y}=this.screenToWorld(e.clientX,e.clientY);
      this.world.avatar.targetX=x;this.world.avatar.targetY=y;
    });
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.cssWidth || 1000;
    const h = this.cssHeight || 700;

    const mx = clientX - rect.left - w / 2;
    const my = clientY - rect.top - h / 2;
    const cos = Math.cos(-this.headingAngle);
    const sin = Math.sin(-this.headingAngle);
    const rx = mx * cos - my * sin + w / 2;
    const ry = mx * sin + my * cos + h / 2;

    return {
      x: (rx - this.camera.x) / this.camera.scale,
      y: (ry - this.camera.y) / this.camera.scale
    };
  }

  startLoop() {
    const loop = () => {
      this.updateAvatar();
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }

  updateAvatar() {
    const avatar = this.world.avatar;

    // If 3D Orbit or FPS mode is active, map-3d.js handles camera-relative avatar locomotion
    if (window.currentViewMode === '3d' || window.currentViewMode === 'fps' || window.currentViewMode === 'thirdPerson' || window.currentViewMode === 'robot') {
      return;
    }

    let screenX = 0;
    let screenY = 0;

    if (this.keys.ArrowUp || this.keys.w) screenY -= 1;
    if (this.keys.ArrowDown || this.keys.s) screenY += 1;
    if (this.keys.ArrowLeft || this.keys.a) screenX -= 1;
    if (this.keys.ArrowRight || this.keys.d) screenX += 1;

    if (screenX !== 0 || screenY !== 0) {
      avatar.targetX = null;
      avatar.targetY = null;

      // Invert heading angle so Up/W ALWAYS moves toward the top of the user's screen
      const angle = -this.headingAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let dx = screenX * cos - screenY * sin;
      let dy = screenX * sin + screenY * cos;

      const len = Math.hypot(dx, dy);
      dx = (dx / len) * avatar.speed;
      dy = (dy / len) * avatar.speed;

      const res = this.world.resolveMove(avatar.x, avatar.y, dx, dy, avatar.radius);
      if (res.moved) {
        avatar.x = res.x;
        avatar.y = res.y;
        avatar.heading = Math.atan2(dy, dx);
        avatar.moving = true;
        this.walkCycle += 0.22;
      }
    } else if (avatar.targetX !== null && avatar.targetY !== null) {
      const tdx = avatar.targetX - avatar.x;
      const tdy = avatar.targetY - avatar.y;
      const dist = Math.hypot(tdx, tdy);
      if (dist > 5) {
        const dx = (tdx / dist) * avatar.speed;
        const dy = (tdy / dist) * avatar.speed;
        const res = this.world.resolveMove(avatar.x, avatar.y, dx, dy, avatar.radius);
        if (res.moved) {
          avatar.x = res.x;
          avatar.y = res.y;
          avatar.heading = Math.atan2(tdy, tdx);
          avatar.moving = true;
          this.walkCycle += 0.22;
        } else {
          avatar.targetX = null;
        }
      } else {
        avatar.moving = false;
        avatar.targetX = null;
      }
    } else {
      avatar.moving = false;
    }
    if(this.environmentObservation&&window.currentViewMode==='fallback')appState.observeEnvironment(this.world,'fallback');
  }

  render() {
    const ctx=this.ctx,w=this.cssWidth||1000,h=this.cssHeight||700;
    ctx.clearRect(0,0,w,h);
    if(this.isFollowingRobot&&this.world.robot) {
      const robot=this.world.robot;
      this.camera.x+=(w/2-robot.x*this.camera.scale-this.camera.x)*.12;
      this.camera.y+=(h/2-robot.y*this.camera.scale-this.camera.y)*.12;
    }
    ctx.save();
    if(this.headingAngle){ctx.translate(w/2,h/2);ctx.rotate(this.headingAngle);ctx.translate(-w/2,-h/2);}
    ctx.translate(this.camera.x,this.camera.y);ctx.scale(this.camera.scale,this.camera.scale);
    if(this.bgLoaded) {
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(this.bgImage,0,0,this.world.width,this.world.height);
    } else {
      ctx.fillStyle='#eaf0f5';ctx.fillRect(0,0,this.world.width,this.world.height);this.renderModelPlan(ctx);
    }
    if(this.environmentObservation&&!appState.isRobotPovActive)this.renderRoomLabels(ctx);
    this.renderFloorTargets(ctx);this.renderDestinations(ctx);this.renderScatteredObjects(ctx);
    this.renderCat(ctx);this.renderRobot(ctx);this.renderAvatar(ctx);this.renderEnvironmentLabels(ctx);
    ctx.restore();
  }

  renderModelPlan(ctx) {
    ctx.fillStyle = '#67533b';
    for (const [x,y,x1,y1] of apartmentCollision.floors) ctx.fillRect(x,y,x1-x,y1-y);
    ctx.fillStyle = '#334155';
    for (const ob of this.world.obstacles) ctx.fillRect(ob.x,ob.y,ob.w,ob.h);
    ctx.strokeStyle = '#d8ceb9';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (const [x,y,x1,y1] of apartmentCollision.walls) {ctx.moveTo(x,y);ctx.lineTo(x1,y1);}
    ctx.stroke();
  }

  renderRoomLabels(ctx) {
    ctx.save();
    for (const r of this.world.rooms) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 13px Inter, -apple-system, sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText(translate(r.name.toUpperCase()), r.labelX, r.labelY);
    }
    ctx.restore();
  }

  setEnvironmentObservation(active) {
    this.environmentObservation=Boolean(active);
  }

  getEnvironmentLabels() {
    if(!this.environmentObservation||appState.isRobotPovActive||globalThis.window?.currentViewMode==='robot')return [];
    return [
      ...this.world.dirtCells.filter(entity=>!entity.cleaned).map(entity=>({entity,text:'Dirt'})),
      ...this.world.wetCells.filter(entity=>!entity.cleaned).map(entity=>({entity,text:'Spill'})),
      ...this.world.objects.filter(entity=>!entity.carried&&!entity.disposed&&!entity.sorted).map(entity=>({entity,text:objectLabel(entity)})),
      {entity:this.world.dock,text:'Charging dock'},{entity:this.world.cat,text:'Cat'},{entity:this.world.avatar,text:'Person'}
    ].map(item=>{const targetId=item.entity.id||{'Charging dock':'DOCK',Cat:'CAT',Person:'PERSON'}[item.text];return {...item,targetId,observed:Boolean(appState.observedEnvironmentTargets?.has(targetId))};});
  }

  renderEnvironmentLabels(ctx) {
    const scale=this.camera.scale;
    for(const {entity,text,observed} of this.getEnvironmentLabels()) {
      ctx.save();ctx.font=`600 ${12/scale}px -apple-system, sans-serif`;ctx.textAlign='center';
      const caption=(observed?'✓ ':'')+translate(text),width=ctx.measureText(caption).width+14/scale,height=24/scale;
      const x=entity.x,y=entity.y-28/scale;
      ctx.fillStyle=observed?'#dcfce7':'rgba(255,255,255,.96)';ctx.strokeStyle=observed?'#16a34a':'#71879c';ctx.lineWidth=1/scale;
      ctx.beginPath();ctx.roundRect(x-width/2,y-height,width,height,5/scale);ctx.fill();ctx.stroke();
      ctx.fillStyle=observed?'#166534':'#263c4c';ctx.fillText(caption,x,y-8/scale);ctx.restore();
    }
  }

  renderFloorTargets(ctx) {
    for(const [index,dirt] of this.world.dirtCells.entries()) {
      if(dirt.cleaned)continue;
      ctx.save();
      for(let i=0;i<26;i++) {
        const seed=Math.sin((i+1)*127.1)*43758.5453;
        const angle=i*2.39996+index*.7,distance=Math.sqrt(seed-Math.floor(seed))*dirt.radius;
        ctx.fillStyle=['#e5dac5','#c5bcae','#807b73'][i%3];
        ctx.beginPath();ctx.ellipse(dirt.x+Math.cos(angle)*distance,dirt.y+Math.sin(angle)*distance,1.5+i%3,1+i%2,angle,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    const outline=[[1.2,0],[1,.66],[.36,.96],[-.36,.78],[-1.14,.48],[-1.35,-.24],[-.48,-.81],[.36,-.9],[1.08,-.45]];
    for(const spill of this.world.wetCells) {
      if(spill.cleaned)continue;
      ctx.save();ctx.fillStyle='rgba(37,186,212,.75)';ctx.strokeStyle='#e7fcff';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(spill.x+(outline.at(-1)[0]+outline[0][0])*spill.radius/2,spill.y+(outline.at(-1)[1]+outline[0][1])*spill.radius/2);
      outline.forEach(([x,y],i)=>{const next=outline[(i+1)%outline.length];ctx.quadraticCurveTo(spill.x+x*spill.radius,spill.y+y*spill.radius,spill.x+(x+next[0])*spill.radius/2,spill.y+(y+next[1])*spill.radius/2);});
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(spill.x-spill.radius*.65,spill.y-spill.radius*.15);ctx.quadraticCurveTo(spill.x-spill.radius*.4,spill.y-spill.radius*.45,spill.x+spill.radius*.1,spill.y-spill.radius*.4);ctx.stroke();ctx.restore();
    }
  }

  renderDestinations(ctx) {
    for(const [target,color] of [[this.world.smartBin,'#22c55e'],[this.world.depositTable,'#a16207']]) {
      ctx.save();ctx.fillStyle=color;ctx.fillRect(target.x-16,target.y-12,32,24);
      if(target===this.world.smartBin) {
        ctx.strokeStyle='#f8fafc';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(target.x-18,target.y-15);
        ctx.lineTo(target.x+18,target.y-(target.isOpen?35:15));ctx.stroke();
      }
      ctx.restore();
    }
    const dock=this.world.dock;
    ctx.save();ctx.fillStyle='#64748b';ctx.fillRect(dock.x-18,dock.y-12,36,24);
    ctx.fillStyle='#334155';ctx.fillRect(dock.x-20,dock.y-15,40,7);
    ctx.fillStyle='#e2e8f0';ctx.fillRect(dock.x-7,dock.y-5,4,8);ctx.fillRect(dock.x+3,dock.y-5,4,8);ctx.restore();
  }

  renderScatteredObjects(ctx) {
    for(const object of this.world.objects) {
      if(object.disposed||object.sorted)continue;
      const kind=objectLabel(object);ctx.save();ctx.translate(object.x,object.y);ctx.lineWidth=1.5;
      if(kind==='Paper') {
        ctx.fillStyle='#f2eee4';ctx.strokeStyle='#ada89f';ctx.beginPath();
        ctx.moveTo(-11,-8);ctx.lineTo(-3,-12);ctx.lineTo(10,-7);ctx.lineTo(12,7);ctx.lineTo(0,10);ctx.lineTo(-10,6);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(-11,-8);ctx.lineTo(1,0);ctx.lineTo(12,7);ctx.moveTo(1,0);ctx.lineTo(-3,-12);ctx.stroke();
      } else if(kind==='Can') {
        ctx.fillStyle='#df5d50';ctx.strokeStyle='#824239';ctx.fillRect(-7,-10,14,20);ctx.strokeRect(-7,-10,14,20);
        ctx.fillStyle='#cbd5e1';ctx.beginPath();ctx.ellipse(0,-10,7,3,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#66717c';ctx.fillRect(-2,-11,4,2);
      } else if(kind==='Mug') {
        ctx.strokeStyle='#e2e5dd';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(10,0,6,7,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#f2f4ef';ctx.strokeStyle='#8f9b9d';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#9c8160';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
      } else {
        ctx.fillStyle='#4c91bd';ctx.strokeStyle='#d3ecfb';ctx.beginPath();ctx.ellipse(0,0,13,10,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#84603d';ctx.beginPath();ctx.ellipse(0,0,9,6,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#b48a5d';for(const [x,y] of [[-4,-2],[2,-3],[4,2],[-2,3]])ctx.fillRect(x,y,2,2);
      }
      ctx.restore();
    }
  }

  renderCat(ctx) {
    const cat = this.world.cat;
    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.rotate(cat.heading);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 3, cat.radius * 1.1, cat.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cat Body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(0, 0, cat.radius, cat.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(10, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(12, -7); ctx.lineTo(16, -12); ctx.lineTo(8, -8);
    ctx.moveTo(12, 7); ctx.lineTo(16, 12); ctx.lineTo(8, 8);
    ctx.fill();

    // Tail swinging
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    const tailAngle = Math.sin(Date.now() / 140) * 8;
    ctx.quadraticCurveTo(-18, tailAngle, -24, tailAngle * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  renderRobot(ctx) {
    const robot=this.world.robot;
    ctx.save();ctx.translate(robot.x,robot.y);ctx.rotate(robot.heading);
    ctx.fillStyle='#334155';ctx.strokeStyle='#94a3b8';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(0,0,robot.radius+2,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#0f172a';ctx.beginPath();ctx.arc(0,0,robot.radius-2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#64748b';ctx.fillRect(-9,-robot.radius-4,18,6);ctx.fillRect(-9,robot.radius-2,18,6);
    ctx.strokeStyle=robot.ledColor;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,robot.radius*.55,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(robot.radius-4,-7,3,0,Math.PI*2);ctx.arc(robot.radius-4,7,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0284c7';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(4,0,2,0,Math.PI*2);ctx.fill();
    if(robot.armExtended) {
      ctx.strokeStyle='#cbd5e1';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(30,0);ctx.stroke();
      ctx.strokeStyle=robot.gripperClosed?'#10b981':'#f59e0b';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(30,-7);ctx.lineTo(37,-2);ctx.moveTo(30,7);ctx.lineTo(37,2);ctx.stroke();
    }
    ctx.restore();
  }

  renderAvatar(ctx) {
    const avatar = this.world.avatar;

    ctx.save();
    ctx.translate(avatar.x, avatar.y);

    // Feet
    if (avatar.moving) {
      const legOffset = Math.sin(this.walkCycle) * 6;
      ctx.fillStyle = '#334155';
      ctx.fillRect(-7 + legOffset, -6, 5, 12);
      ctx.fillRect(2 - legOffset, -6, 5, 12);
    }

    ctx.rotate(avatar.heading);

    // Body
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, avatar.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Direction Visor
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(avatar.radius - 4, -4, 6, 8);

    ctx.restore();
  }


}
