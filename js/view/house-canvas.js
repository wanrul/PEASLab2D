import { translate } from '../i18n.js';
/**
 * CollabPEAS - High-Fidelity Realistic Apartment Canvas Engine
 * Directly renders Materials/Apartment.png at full native resolution with high-DPI scaling.
 * Features smooth camera pan & zoom, operator locomotion, roaming cat NPC,
 * cleaning robot, particle effects, teleportation pads, and interactive stations.
 */

import { appState } from '../state.js';
import { apartmentCollision } from '../sim/apartment-collision-data.js';

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
    this.teleportRipple = null;

    // Interactive Stations in the House (Step 1-5 distributed across apartment rooms)
    this.stations = [
      { step: 1, name: 'Priorities', x: 450, y: 380, radius: 42, icon: '🎯' },
      { step: 2, name: 'Sensors', x: 340, y: 820, radius: 42, icon: '📡' },
      { step: 3, name: 'Body', x: 350, y: 480, radius: 42, icon: '🦾' },
      { step: 4, name: 'Rules', x: 600, y: 860, radius: 42, icon: '🧩' },
      { step: 5, name: 'Run', x: 880, y: 860, radius: 42, icon: '🔬' }
    ];

    for (const station of this.stations) {
      Object.assign(station, this.world.nearestWalkable(station.x, station.y, 24));
    }

    this.activeStationPrompt = null;
    this.hoveredTeleport = null;
    this.hoveredTag = null;

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
      if (modal && modal.style.display !== 'none') return;

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
      if (e.key === ' ' && this.activeStationPrompt) {
        (window.navigateStep || window.openStepModal)?.(this.activeStationPrompt.step);
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

      // Check hover on teleport pads or tags
      const { x, y } = this.screenToWorld(e.clientX, e.clientY);
      this.hoveredTeleport = null;
      for (const tp of this.world.teleportMarkers) {
        if (Math.hypot(x - tp.x, y - tp.y) < 28) {
          this.hoveredTeleport = tp;
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      for (const st of this.stations) {
        if (Math.hypot(x - st.x, y - st.y) < st.radius) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'default';
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Click handler for teleports and stations
    this.canvas.addEventListener('click', (e) => {
      if (this.hasDragged) return; // ignore drag release

      const { x, y } = this.screenToWorld(e.clientX, e.clientY);

      // 1. Check Teleport Pad Click
      for (const tp of this.world.teleportMarkers) {
        if (Math.hypot(x - tp.x, y - tp.y) < 28) {
          this.teleportAvatar(tp.x, tp.y);
          return;
        }
      }

      // 2. Check Click on Stations
      for (const st of this.stations) {
        if (Math.hypot(x - st.x, y - st.y) < st.radius + 10) {
          (window.navigateStep || window.openStepModal)?.(st.step);
            return;
        }
      }

      // 3. Check Click on Inspection Tags
      for (const tag of this.world.inspectionTags) {
        if (Math.hypot(x - tag.x, y - tag.y) < 24) {
          this.hoveredTag = tag;
          this.inspectTag(tag);
          return;
        }
      }

      // 4. Click to move avatar
      this.world.avatar.targetX = x;
      this.world.avatar.targetY = y;
    });
  }

  inspectTag(tag) {
    this.hoveredTag = tag;
    appState.recordHotspot?.(tag.id, '2d');
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

  teleportAvatar(targetX, targetY) {
    if (this.world.checkCollision(targetX, targetY, this.world.avatar.radius)) return;
    this.world.avatar.x = targetX;
    this.world.avatar.y = targetY;
    this.world.avatar.targetX = null;
    this.world.avatar.targetY = null;
    this.teleportRipple = { x: targetX, y: targetY, radius: 10, alpha: 1.0 };
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
    if (window.currentViewMode === '3d' || window.currentViewMode === 'fps' || window.currentViewMode === 'robot') {
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

    const nearbyTag = this.world.inspectionTags.find(tag => Math.hypot(avatar.x - tag.x, avatar.y - tag.y) < 65);
    if (nearbyTag && nearbyTag !== this.nearbyTag) this.inspectTag(nearbyTag);
    this.nearbyTag = nearbyTag;

    // Check proximity to stations
    this.activeStationPrompt = null;
    for (const st of this.stations) {
      const dist = Math.hypot(avatar.x - st.x, avatar.y - st.y);
      if (dist < st.radius + 20) {
        this.activeStationPrompt = st;
        break;
      }
    }

    // Teleport ripple
    if (this.teleportRipple) {
      this.teleportRipple.radius += 2.5;
      this.teleportRipple.alpha -= 0.04;
      if (this.teleportRipple.alpha <= 0) {
        this.teleportRipple = null;
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.cssWidth || 1000;
    const h = this.cssHeight || 700;

    ctx.clearRect(0, 0, w, h);

    // Smoothly follow robot if follow camera is enabled
    if (this.isFollowingRobot && this.world.robot) {
      const r = this.world.robot;
      const targetCamX = w / 2 - r.x * this.camera.scale;
      const targetCamY = h / 2 - r.y * this.camera.scale;
      this.camera.x += (targetCamX - this.camera.x) * 0.12;
      this.camera.y += (targetCamY - this.camera.y) * 0.12;
    }

    ctx.save();
    if (this.headingAngle) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(this.headingAngle);
      ctx.translate(-w / 2, -h / 2);
    }
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.scale, this.camera.scale);

    // 1. Draw model-aligned overhead apartment
    if (this.bgLoaded) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.bgImage, 0, 0, this.world.width, this.world.height);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, this.world.width, this.world.height);
      this.renderModelPlan(ctx);
    }

    // 2. Room Name Labels (Subtle, architectural floating typography)
    this.renderRoomLabels(ctx);

    // 3. Teleportation Target Markers (Fusion VR Training)
    this.renderTeleportPads(ctx);

    // 4. Interactive Stations in the House (Step 1-5 Holographic Rings)
    this.renderStations(ctx);

    // 5. Environmental Inspection Tags (Step 2A)
    this.renderInspectionTags(ctx);

    // 6. Interactive Dirt Specks & Shimmering Spills
    this.renderFloorTargets(ctx);

    // 7. Scattered Objects (Trash & Belongings)
    this.renderDestinations(ctx);
    this.renderScatteredObjects(ctx);

    // 8. Roaming Cat NPC
    this.renderCat(ctx);

    // 9. Cleaning Robot
    this.renderRobot(ctx);

    // 10. Operator Avatar
    this.renderAvatar(ctx);

    // 11. Teleport Ripple
    if (this.teleportRipple) {
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${this.teleportRipple.alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.teleportRipple.x, this.teleportRipple.y, this.teleportRipple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 12. Screen-Space UI Overlays
    this.renderScreenOverlays(ctx);
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

  renderTeleportPads(ctx) {
    for (const tp of this.world.teleportMarkers) {
      const isHovered = this.hoveredTeleport === tp;
      ctx.save();

      // Outer Pulse Ring
      ctx.strokeStyle = isHovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, isHovered ? 24 : 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner Glowing Disc
      ctx.fillStyle = isHovered ? 'rgba(56, 189, 248, 0.35)' : 'rgba(15, 23, 42, 0.65)';
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Icon & Name
      ctx.font = '12px sans-serif';
      ctx.fillText(tp.icon, tp.x - 6, tp.y + 4);

      if (isHovered) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        const msg = translate(`⚡ Teleport to ${tp.name}`);
        ctx.font = 'bold 11px Inter, sans-serif';
        const w = ctx.measureText(msg).width + 16;
        ctx.fillRect(tp.x - w / 2, tp.y - 34, w, 20);
        ctx.strokeRect(tp.x - w / 2, tp.y - 34, w, 20);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(msg, tp.x, tp.y - 20);
      }

      ctx.restore();
    }
  }

  renderStations(ctx) {
    for (const st of this.stations) {
      ctx.save();
      const isCurrent = appState.currentStep === st.step;
      const isNearby = this.activeStationPrompt === st;

      // Glow halo
      ctx.strokeStyle = isCurrent ? '#38bdf8' : isNearby ? '#facc15' : 'rgba(255, 255, 255, 0.5)';
      ctx.fillStyle = isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.75)';
      ctx.lineWidth = isNearby ? 3.5 : 2;

      ctx.beginPath();
      ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '18px sans-serif';
      ctx.fillText(st.icon, st.x - 9, st.y - 4);

      ctx.fillStyle = isCurrent ? '#38bdf8' : '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(translate(`Step ${st.step}`), st.x, st.y + 16);

      ctx.restore();
    }
  }

  renderInspectionTags(ctx) {
    for (const tag of this.world.inspectionTags) {
      ctx.save();
      const distToAvatar = Math.hypot(this.world.avatar.x - tag.x, this.world.avatar.y - tag.y);
      const isClose = distToAvatar < 65;

      ctx.fillStyle = isClose ? '#facc15' : '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tag.x, tag.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '12px sans-serif';
      ctx.fillText(tag.icon, tag.x - 6, tag.y + 4);

      if (isClose || this.hoveredTag === tag) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        const text = translate(tag.text);
        ctx.font = 'bold 11px Inter, sans-serif';
        const w = ctx.measureText(text).width + 16;
        ctx.fillRect(tag.x - w / 2, tag.y - 38, w, 22);
        ctx.strokeRect(tag.x - w / 2, tag.y - 38, w, 22);

        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(text, tag.x, tag.y - 23);
      }
      ctx.restore();
    }
  }

  renderFloorTargets(ctx) {
    // Dirt Cells
    for (const d of this.world.dirtCells) {
      if (!d.cleaned) {
        ctx.save();
        ctx.fillStyle = 'rgba(120, 53, 15, 0.75)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(69, 26, 3, 0.95)';
        ctx.fillRect(d.x - 4, d.y - 3, 3, 3);
        ctx.fillRect(d.x + 3, d.y + 2, 2, 2);
        ctx.fillRect(d.x, d.y + 4, 3, 2);
        ctx.restore();
      }
    }

    // Wet Spills
    for (const w of this.world.wetCells) {
      if (!w.cleaned) {
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, w.radius * 1.3, w.radius * 0.9, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '14px sans-serif';
        ctx.fillText('💧', w.x - 7, w.y + 5);
        ctx.restore();
      }
    }
  }

  renderDestinations(ctx) {
    for(const [target,label,color] of [[this.world.smartBin,this.world.smartBin.isOpen?'Bin · lid open':'Bin','#22c55e'],[this.world.depositTable,'Belongings destination','#a16207']]) {
      ctx.save();ctx.fillStyle=color;ctx.fillRect(target.x-16,target.y-12,32,24);
      if(target===this.world.smartBin) {
        ctx.strokeStyle='#f8fafc';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(target.x-18,target.y-15);
        ctx.lineTo(target.x+18,target.y-(target.isOpen?35:15));ctx.stroke();
      }
      ctx.fillStyle='#f8fafc';ctx.font='12px sans-serif';ctx.fillText(translate(label),target.x-20,target.y+30);ctx.restore();
    }
  }

  renderScatteredObjects(ctx) {
    for (const obj of this.world.objects) {
      if (!obj.disposed) {
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = obj.type === 'TRASH' ? '#f43f5e' : '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '14px sans-serif';
        ctx.fillText(obj.icon, obj.x - 7, obj.y + 5);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(translate(obj.name), obj.x - 20, obj.y + 22);
        ctx.restore();
      }
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

    ctx.fillStyle = '#ffedd5';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(translate('🐱 Roaming Cat'), cat.x, cat.y - 18);
  }

  renderRobot(ctx) {
    const robot = this.world.robot;
    const installed = appState.installedSensors;

    // 1. High-Visibility Animated Pulsing Ground Beacon
    const pulse = Math.sin(Date.now() / 160) * 4;
    const beaconRadius = robot.radius + 14 + pulse;
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, beaconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Forward Headlight Beams & Directional Cone
    ctx.rotate(robot.heading);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.moveTo(10, -6);
    ctx.lineTo(55, -24);
    ctx.lineTo(55, 24);
    ctx.lineTo(10, 6);
    ctx.closePath();
    ctx.fill();

    // 3. Chassis Base (Chrome Bevel + Metallic Slate Body)
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, robot.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner Metallic Core
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, robot.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-9, -robot.radius - 4, 18, 6);
    ctx.fillRect(-9, robot.radius - 2, 18, 6);

    // Status LED Ring
    ctx.strokeStyle = robot.ledColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, robot.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Headlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(robot.radius - 4, -7, 3.5, 0, Math.PI * 2);
    ctx.arc(robot.radius - 4, 7, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Lidar Scanner Dome with Red Laser Eye
    const lidarAngle = (Date.now() / 120) % (Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(Math.cos(lidarAngle) * 5, Math.sin(lidarAngle) * 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Arm & Gripper
    if (robot.armExtended) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.strokeStyle = robot.gripperClosed ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(30, -7); ctx.lineTo(37, -2);
      ctx.moveTo(30, 7); ctx.lineTo(37, 2);
      ctx.stroke();
    }

    // Front Direction Arrow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

    ctx.restore();

    // 4. Game HUD Nameplate (High-contrast, bold, impossible to miss)
    ctx.save();
    const trace = robot.traceState;
    const actText = trace?.action ? `⚙️ ${trace.action}` : (robot.vacuumActive ? '⚙️ VACUUM ON' : robot.mopDeployed ? '⚙️ MOPPING' : '⚙️ READY / CRUISING');
    const battText = `🔋 ${Math.round(robot.battery)}%`;
    const subText = translate(`${actText} • ${battText}`);

    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const titleWidth = ctx.measureText(translate('🤖 CLEANING ROBOT')).width;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const subWidth = ctx.measureText(subText).width;
    const pillW = Math.max(titleWidth, subWidth) + 24;
    const pillH = 34;
    const pillX = robot.x - pillW / 2;
    const pillY = robot.y - 56;

    // Background Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();

    // Downward pointer triangle
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(robot.x - 6, pillY + pillH);
    ctx.lineTo(robot.x + 6, pillY + pillH);
    ctx.lineTo(robot.x, pillY + pillH + 6);
    ctx.closePath();
    ctx.fill();

    // Title Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(translate('🤖 CLEANING ROBOT'), robot.x, pillY + 14);

    // Subtitle / Action & Battery
    ctx.fillStyle = robot.isStopped ? '#f87171' : robot.isSlow ? '#fbbf24' : '#34d399';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subText, robot.x, pillY + 28);

    ctx.restore();
  }

  renderAvatar(ctx) {
    const avatar = this.world.avatar;

    ctx.save();
    ctx.translate(avatar.x, avatar.y);

    // 2-Meter Proximity Circle
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

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

    ctx.fillStyle = '#bfdbfe';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(translate('👤 You'), avatar.x, avatar.y - 24);
  }

  renderScreenOverlays(ctx) {
    const w = this.cssWidth || 1000;
    const h = this.cssHeight || 700;

    // Do not draw station prompt if modal is currently open
    const modal = document.getElementById('stepModalOverlay');
    if (modal && modal.style.display !== 'none') return;

    // 1. Station Spacebar Prompt
    if (this.activeStationPrompt) {
      const st = this.activeStationPrompt;
      ctx.save();
      const msg = translate(`⚡ Press [SPACE] or Click to open ${st.name}`);
      ctx.font = 'bold 13px Inter, sans-serif';
      const tw = ctx.measureText(msg).width + 36;
      const x = (w - tw) / 2;
      const y = h - 85;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, tw, 36);
      ctx.strokeRect(x, y, tw, 36);

      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.fillText(msg, x + 18, y + 23);
      ctx.restore();
    }
  }
}
