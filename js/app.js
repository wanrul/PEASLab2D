import { PILOT_STAGES } from './pilot-config.js';
/**
 * PEASLab2D - Main Application Coordinator (v0.3)
 * Integrates 3D 360-Degree WebGL Engine (Apartment.glb), 360° OrbitControls & FPS Walkthrough,
 * 2D 360-degree Rotatable Blueprint Canvas, Interactive 360° Compass Widget,
 * Fullscreen Map Layer with Step Popup Workstations, 10Hz Simulation Engine, and Personal Observation Logging.
 */

import { appState } from './state.js';
import { ApartmentWorld } from './sim/world.js';
import { SimulationEngine } from './sim/engine.js';
import { HouseCanvasRenderer } from './view/house-canvas.js';
import { Apartment3DMap } from './view/map-3d.js';
import { RobotPovRenderer } from './view/pov-renderer.js';
import { BlockCanvasView } from './view/block-canvas.js';
import { StepsView } from './view/steps-view.js';
import { sound } from './view/audio.js';
import { sessionLogger } from './logging/session-log.js';

window.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize World Model
  const world = new ApartmentWorld();

  // 2. Initialize 2D Interactive House Canvas (Rotatable 360°)
  const canvasEl = document.getElementById('houseCanvas');
  const houseCanvas = new HouseCanvasRenderer(canvasEl, world);
  window.houseCanvas = houseCanvas;

  // 3. Initialize 3D 360° WebGL Three.js Engine (Apartment.glb)
  const threeCanvasEl = document.getElementById('threeCanvas');
  let map3d = null;
  try {
    map3d = new Apartment3DMap(threeCanvasEl, world);
    window.map3d = map3d;
  } catch (err) {
    console.warn('⚠️ WebGL 3D Map failed to initialize, falling back to 360° 2D Canvas:', err);
  }

  // 4. Initialize 10Hz Simulation Engine
  const simEngine = new SimulationEngine(world);
  window.simEngine = simEngine;

  // 5. Initialize Subview Components
  const blockCanvasContainer = document.getElementById('blockCanvasMount');
  const blockCanvasView = new BlockCanvasView(blockCanvasContainer);

  const stepsPanelEl = document.getElementById('stepsPanelMount');
  const stepsView = new StepsView(stepsPanelEl, blockCanvasView, null);

  const povModalEl = document.getElementById('robotPovModal');
  const povRenderer = new RobotPovRenderer(povModalEl, world, {
    map3d, engine: simEngine,
    capturePage: () => ({
      mode: currentViewMode, step: appState.currentStep,
      modalOpen: modalOverlay.style.display !== 'none',
      scrollTop: document.querySelector('.step-modal-body').scrollTop,
      mapCamera: { ...houseCanvas.camera }, heading: houseCanvas.headingAngle,
      following: houseCanvas.isFollowingRobot
    }),
    showCamera: () => {
      closeStepModal();
      switchViewMode('robot');
      document.getElementById('quickPovBtn').innerText = 'Exit Robot POV';
    },
    restorePage: saved => {
      switchViewMode(saved.mode);
      houseCanvas.camera = { ...saved.mapCamera };
      houseCanvas.headingAngle = saved.heading;
      houseCanvas.isFollowingRobot = saved.following;
      if (saved.modalOpen) openStepModal(saved.step);
      else closeStepModal();
      document.querySelector('.step-modal-body').scrollTop = saved.scrollTop;
      document.getElementById('quickPovBtn').innerText = '👁️ POV';
    }
  });
  window.enterRobotPov = () => povRenderer.enter();
  window.exitRobotPov = () => povRenderer.exit();

  // -------------------------------------------------------------
  // 360-DEGREE VIEW MODE SWITCHER (3D 360° / FPS 360° / 2D Map)
  // -------------------------------------------------------------
  const viewMode3DBtn = document.getElementById('viewMode3DBtn');
  const viewModeFpsBtn = document.getElementById('viewModeFpsBtn');
  const mapControlsHint = document.getElementById('mapControlsHint');

  let currentViewMode = 'fps'; // '3d' | 'fps' | internal 'fallback'
  window.currentViewMode = 'fps';

  function switchViewMode(mode) {
    if (!['3d','fps','robot','fallback'].includes(mode)) return;
    if (!map3d && mode !== 'fallback') mode = 'fallback';
    if (appState.isRobotPovActive && mode !== 'robot') povRenderer.exit();
    currentViewMode = mode;
    window.currentViewMode = mode;
    [viewMode3DBtn, viewModeFpsBtn].forEach(b => b?.classList.remove('active'));

    if (mode === 'robot') {
      if (threeCanvasEl) threeCanvasEl.style.display = 'block';
      if (canvasEl) canvasEl.style.display = 'none';
      const overlay = document.getElementById('glbLoadingOverlay');
      if (overlay) overlay.style.display = 'none';
      map3d.setViewMode('robot');
      map3d.onResize();
      if (mapControlsHint) mapControlsHint.innerText = '🤖 Robot camera follows movement and heading • Exit Robot POV or Esc to return';
    } else if (mode === '3d') {
      viewMode3DBtn?.classList.add('active');
      if (threeCanvasEl) threeCanvasEl.style.display = 'block';
      if (canvasEl) canvasEl.style.display = 'none';
      if (map3d) {
        map3d.setViewMode('orbit');
        map3d.onResize();
      }
      if (mapControlsHint) {
        mapControlsHint.innerHTML = `
          <span class="hint-key">🖱️ Orbit</span> Left-Drag 360°
          <span class="hint-sep">•</span>
          <span class="hint-key">📜 Zoom</span> Wheel
          <span class="hint-sep">•</span>
          <span class="hint-key">📐 Pan</span> Right-Drag
          <span class="hint-sep">•</span>
          <span class="hint-key">🎮 Move</span> WASD / Arrows
          <span class="hint-sep">•</span>
          <span class="hint-key">🎯 Stations</span> Click 3D Ring
        `;
      }
    } else if (mode === 'fps') {
      viewModeFpsBtn?.classList.add('active');
      if (threeCanvasEl) threeCanvasEl.style.display = 'block';
      if (canvasEl) canvasEl.style.display = 'none';
      if (map3d) {
        map3d.setViewMode('fps');
        map3d.onResize();
      }
      if (mapControlsHint) {
        mapControlsHint.innerHTML = `
          <span class="hint-key">🚶 Walk</span> WASD / Arrows
          <span class="hint-sep">•</span>
          <span class="hint-key">👁️ Look 360°</span> Drag Mouse
          <span class="hint-sep">•</span>
          <span class="hint-key">🎯 Stations</span> Walk to Ring & [SPACE]
        `;
      }
    } else if (mode === 'fallback') {
      const loadingOverlay = document.getElementById('glbLoadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (threeCanvasEl) threeCanvasEl.style.display = 'none';
      if (canvasEl) canvasEl.style.display = 'block';
      houseCanvas.resizeCanvas();
      houseCanvas.fitView();
      if (mapControlsHint) {
        mapControlsHint.innerHTML = `
          <span class="hint-key">🎮 Move</span> WASD / Arrows
          <span class="hint-sep">•</span>
          <span class="hint-key">🖱️ Pan</span> Drag
          <span class="hint-sep">•</span>
          <span class="hint-key">📜 Zoom</span> Wheel
          <span class="hint-sep">•</span>
          <span class="hint-key">🧭 360°</span> Q / E Keys
          <span class="hint-sep">•</span>
          <span class="hint-key">🎯 Stations</span> [SPACE]
        `;
      }
    }
  }

  window.switchViewMode = switchViewMode;

  viewMode3DBtn?.addEventListener('click', () => { switchViewMode('3d'); });
  viewModeFpsBtn?.addEventListener('click', () => { switchViewMode('fps'); });

  // -------------------------------------------------------------
  // INTERACTIVE 360-DEGREE COMPASS WIDGET
  // -------------------------------------------------------------
  document.querySelectorAll('.compass-btn[data-angle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const angle = parseInt(btn.getAttribute('data-angle'), 10);
      if (currentViewMode === 'fallback') {
        houseCanvas.setHeading(angle);
      } else if (map3d) {
        map3d.setHeading(angle);
      }
    });
  });

  const autoSpinBtn = document.getElementById('autoSpinBtn');
  autoSpinBtn?.addEventListener('click', () => {
    if (map3d) {
      const isSpinning = map3d.toggleAutoSpin();
      if (isSpinning) {
        autoSpinBtn.classList.add('active');
      } else {
        autoSpinBtn.classList.remove('active');
      }
    }
  });

  // Compass Dial Dragging to Spin 360°
  const compassDial = document.getElementById('compassDial');
  let isDialDragging = false;

  const handleDialRotation = (e) => {
    if (!compassDial) return;
    const rect = compassDial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const rad = Math.atan2(dx, -dy);
    const deg = Math.round(((rad * 180 / Math.PI) % 360 + 360) % 360);

    if (currentViewMode === 'fallback') {
      houseCanvas.setHeading(deg);
    } else if (map3d) {
      map3d.setHeading(deg);
    }
  };

  compassDial?.addEventListener('mousedown', (e) => {
    isDialDragging = true;
    handleDialRotation(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDialDragging) {
      handleDialRotation(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isDialDragging = false;
  });

  // Focus Robot Button
  const focusRobotBtn = document.getElementById('focusRobotBtn');
  focusRobotBtn?.addEventListener('click', () => {
    if (appState.isRobotPovActive) return;
    if (currentViewMode === 'fallback') {
      houseCanvas.focusRobot();
    } else if (map3d) {
      map3d.focusRobot();
    }
  });

  // Follow Robot Camera Toggle
  const followRobotBtn = document.getElementById('followRobotBtn');
  followRobotBtn?.addEventListener('click', () => {
    if (appState.isRobotPovActive) return;
    let isFollowing = false;
    if (currentViewMode === 'fallback') {
      isFollowing = houseCanvas.toggleFollowRobot();
    } else if (map3d) {
      isFollowing = map3d.toggleFollowRobot();
    }
    if (isFollowing) {
      followRobotBtn.classList.add('active');
      followRobotBtn.innerText = '🎥 Following...';
    } else {
      followRobotBtn.classList.remove('active');
      followRobotBtn.innerText = '🎥 Follow Robot';
    }
  });

  // Recenter Map Button
  const recenterMapBtn = document.getElementById('recenterMapBtn');
  recenterMapBtn?.addEventListener('click', () => {
    if (appState.isRobotPovActive) return;
    if (currentViewMode === 'fallback') {
      houseCanvas.setHeading(0);
      houseCanvas.fitView();
    } else if (map3d) {
      map3d.setViewMode('orbit');
    }
  });

  // -------------------------------------------------------------
  // STEP MODAL POPUP SYSTEM (Full-Screen Map -> Popup Workstation)
  // -------------------------------------------------------------
  const modalOverlay = document.getElementById('stepModalOverlay');
  const modalBadge = document.getElementById('modalStepBadge');
  const modalHeading = document.getElementById('modalStepHeading');
  const modalCloseBtn = document.getElementById('stepModalCloseBtn');
  const modalTabs = document.querySelectorAll('.modal-tab-btn');
  const topNavItems = document.querySelectorAll('.step-nav-item');
  const openWorkstationBtn = document.getElementById('openWorkstationBtn');
  const openWorkstationFabBtn = document.getElementById('openWorkstationFabBtn');

  const STEP_METADATA = {
    1: { badge: 'STEP 1 OF 5 • PEAS: P', heading: 'Set your robot priorities' },
    2: { badge: 'STEP 2 OF 5 • PEAS: E + S', heading: 'Give your robot senses' },
    3: { badge: 'STEP 3 OF 5 • PEAS: A', heading: 'Give your robot a body' },
    4: { badge: 'STEP 4 OF 5 • PEAS: LOGIC', heading: 'Program your robot' },
    5: { badge: 'STEP 5 OF 5 • PEAS: TEST & REFLECT', heading: 'Run it' }
  };

  function updateStepUi(step) {
    const body=document.querySelector('.step-modal-body');
    body.classList.toggle('mounting-body',step===2 || step===3);
    body.classList.toggle('rule-body',step===4);
    modalOverlay?.classList.toggle('testing-layout',step === 5);
    document.getElementById('simFloatingHud').hidden = step !== 5 || Boolean(appState.sessionFinished);
    topNavItems.forEach(item => {
      const s = parseInt(item.getAttribute('data-step'), 10);
      item.disabled = !appState.canEnterStep(s) || (appState.sessionFinished && s!==5);
      if (s === step) item.classList.add('active');
      else item.classList.remove('active');
    });

    modalTabs.forEach(tab => {
      const s = parseInt(tab.getAttribute('data-step'), 10);
      tab.disabled = !appState.canEnterStep(s) || (appState.sessionFinished && s!==5);
      if (s === step) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    if (STEP_METADATA[step]) {
      if (modalBadge) modalBadge.innerText = `STAGE ${appState.currentStage} OF ${PILOT_STAGES.length} · ${STEP_METADATA[step].badge}`;
      if (modalHeading) modalHeading.innerText = STEP_METADATA[step].heading;
    }

    if (step === 4) {
      if (blockCanvasContainer) blockCanvasContainer.style.display = 'block';
      if (stepsPanelEl) stepsPanelEl.style.display = 'none';
      blockCanvasView.render();
    } else {
      if (blockCanvasContainer) blockCanvasContainer.style.display = 'none';
      if (stepsPanelEl) stepsPanelEl.style.display = 'block';
      stepsView.render();
    }
  }

  function openStepModal(stepNumber) {
    if (appState.isRobotPovActive) povRenderer.exit();
    if (stepNumber !== undefined && stepNumber !== null) {
      if(appState.sessionFinished && stepNumber!==5)return;
      if(appState.currentStep===5 && stepNumber!==5)simEngine.endRun('revision');
      if (!appState.setStep(stepNumber)) return;
    }
    updateStepUi(appState.currentStep);
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
    }
  }

  function closeStepModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
    }
  }

  window.openStepModal = openStepModal;
  window.navigateStep = openStepModal;
  window.startRulePreview = () => { if (appState.currentStep === 4) simEngine.startPreview(); };
  window.closeStepModal = closeStepModal;

  modalCloseBtn?.addEventListener('click', closeStepModal);

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeStepModal();
    }
  });

  topNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.getAttribute('data-step'), 10);
      openStepModal(step);
    });
  });

  modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const step = parseInt(tab.getAttribute('data-step'), 10);
      openStepModal(step);
    });
  });

  openWorkstationBtn?.addEventListener('click', () => openStepModal(appState.currentStep));
  openWorkstationFabBtn?.addEventListener('click', () => openStepModal(appState.currentStep));

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (appState.isRobotPovActive) {
      if (e.key === 'Escape') { povRenderer.exit(); e.preventDefault(); }
      return;
    }
    if (modalOverlay && modalOverlay.style.display !== 'none') {
      if (e.key === 'Escape') {
        closeStepModal();
        e.preventDefault();
      }
      return;
    }

    if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (houseCanvas.activeStationPrompt) {
        openStepModal(houseCanvas.activeStationPrompt.step);
      } else {
        openStepModal(appState.currentStep);
      }
      e.preventDefault();
    }
  });

  appState.on('stageChanged',()=>{
    simEngine.reset();
    updateStepUi(1);
    const stageLabel=`Stage ${appState.currentStage} of ${PILOT_STAGES.length} · ${PILOT_STAGES[appState.currentStage-1].name}`;
    document.getElementById('stageProgress').textContent=stageLabel;
    document.getElementById('hudTaskName').textContent=stageLabel;
  });
  appState.record('STAGE_STARTED',String(appState.currentStage));

  appState.on('stepChanged', ({ step, oldStep }) => {
    if (oldStep === 4) simEngine.stopPreview();
    if (oldStep === 5 && step !== 5) simEngine.endRun('revision');
    if (step !== 5) document.getElementById('reflectionPanel')?.remove();
    updateStepUi(step);
    document.querySelector('.step-modal-body').scrollTop=0;
    if(step===4 && appState.canContinue(4))simEngine.startPreview();
    if(step===5)appState.notify('tick',{tick:simEngine.tickCount,scores:simEngine.scores,robot:world.robot});
  });

  // -------------------------------------------------------------
  // AUDIO & POV CONTROLS
  // -------------------------------------------------------------
  const muteBtn = document.getElementById('muteToggleBtn');
  muteBtn?.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    muteBtn.innerText = isMuted ? '🔇 Off' : '🔊 On';
  });

  const quickPovBtn = document.getElementById('quickPovBtn');
  quickPovBtn?.addEventListener('click', () => {
    if (appState.isRobotPovActive) povRenderer.exit();
    else povRenderer.enter();
  });

  // -------------------------------------------------------------
  // FLOATING SIMULATION HUD ON THE FULLSCREEN MAP
  // -------------------------------------------------------------
  const hudPlayPauseBtn = document.getElementById('hudPlayPauseBtn');
  const hudResetBtn = document.getElementById('hudResetBtn');
  const hudStatusDot = document.getElementById('hudStatusDot');
  const hudStatusText = document.getElementById('hudStatusText');
  const hudTickText = document.getElementById('hudTickText');
  const hudOpenLabBtn = document.getElementById('hudOpenLabBtn');
  const hudSpeedBtns = document.querySelectorAll('.hud-speed-btn');

  hudPlayPauseBtn?.addEventListener('click', () => {
    if(appState.sessionFinished || appState.currentStep!==5)return;
    if (appState.simRunning) {
      simEngine.stop();
      hudPlayPauseBtn.innerText = '▶';
      hudStatusDot?.classList.remove('running');
      hudStatusDot?.classList.add('paused');
      if (hudStatusText) hudStatusText.innerText = 'SIM PAUSED';
    } else {
      if (appState.currentStep !== 5) return;
      simEngine.start();
      sound.playEvent?.('run');
      hudPlayPauseBtn.innerText = '⏸';
      hudStatusDot?.classList.add('running');
      hudStatusDot?.classList.remove('paused');
      if (hudStatusText) hudStatusText.innerText = 'SIM RUNNING';
    }
  });

  hudResetBtn?.addEventListener('click', () => {
    if(appState.sessionFinished || appState.currentStep!==5)return;
    simEngine.reset();
  });

  hudSpeedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const spd = parseInt(btn.getAttribute('data-speed'), 10);
      simEngine.setSpeed(spd);
      hudSpeedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('hudStampPass')?.addEventListener('click', () => {
    appState.addObservation('✓', 'Observed in full-screen 360° map');
  });
  document.getElementById('hudStampFail')?.addEventListener('click', () => {
    appState.addObservation('✗', 'Observed mismatch in full-screen 360° map');
  });
  document.getElementById('hudStampQuery')?.addEventListener('click', () => {
    appState.addObservation('?', 'Marked for individual review');
  });

  hudOpenLabBtn?.addEventListener('click', () => {
    openStepModal(5);
  });

  function updateHudEvidence() {
    if (hudTickText) hudTickText.innerText = `Tick ${simEngine.tickCount}`;
    const criteria = document.getElementById('hudCriteria');
    if (criteria) criteria.textContent = simEngine.criteriaResults.map(c=>`${c.observed}: ${c.status}`).join(' · ') + ` · ${simEngine.elapsedSeconds.toFixed(1)} seconds elapsed`;
  }
  appState.on('tick', () => {
    updateHudEvidence();
    if(appState.currentStep===4){const preview=document.getElementById('ruleApartmentPreview');if(preview)preview.getContext('2d').drawImage(canvasEl,0,0,preview.width,preview.height);}
  });
  appState.on('simReset',updateHudEvidence);

  appState.on('simStateChanged',({running})=>{
    updateHudEvidence();
    if(hudPlayPauseBtn)hudPlayPauseBtn.textContent=running?'Pause':'Run';
    if(hudStatusText)hudStatusText.textContent=running?'RUNNING':'PAUSED';
  });
  // Initialize UI with initial state (Default Step 1 loaded in background)
  updateStepUi(appState.currentStep);

  // Start in the fixed living-room walkthrough; open the workstation on demand.
  switchViewMode(map3d ? 'fps' : 'fallback');
  closeStepModal();

  console.log('🚀 PEASLab2D Initialized for Individual Learning.');
});
