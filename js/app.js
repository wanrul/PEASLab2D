import { initLanguage } from './i18n.js';
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
import { ENVIRONMENT_ITEMS } from './data/environment.js';

window.addEventListener('DOMContentLoaded', async () => {
  initLanguage();
  // Temporary local preview entries; the normal URL keeps the full study flow.
  const preview = new URLSearchParams(location.search).get('preview');
  appState.localPreview = ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && ['sensors','logic','logic-answer'].includes(preview);
  // 1. Initialize World Model
  const world = new ApartmentWorld();
  appState.configureEnvironment(world);

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
      mode: currentViewMode, step: dashboardStep,
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

  let currentViewMode = 'fps'; // '3d' | 'fps' | 'thirdPerson' | internal 'fallback'
  window.currentViewMode = 'fps';

  function switchViewMode(mode) {
    if (!['3d','fps','thirdPerson','robot','fallback'].includes(mode)) return;
    if (appState.isRobotPovActive && mode !== 'robot') povRenderer.exit();
    if (mode==='fps' || mode==='thirdPerson' || mode==='3d') appState.environmentWalkingEnabled=true;
    else if (mode==='robot') appState.environmentWalkingEnabled=false;
    if (!map3d && mode !== 'fallback') mode = 'fallback';
    currentViewMode = mode;
    window.currentViewMode = mode;
    document.querySelectorAll('[data-environment-view]').forEach(button => {
      const selected = button.dataset.environmentView === (mode === '3d' ? 'whole' : mode);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
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
        `;
      }
    } else if (mode === 'fps' || mode === 'thirdPerson') {
      if(mode==='fps')viewModeFpsBtn?.classList.add('active');
      if(mode==='thirdPerson') {
        const followButton=document.getElementById('followRobotBtn');
        followButton?.classList.remove('active');
        if(followButton)followButton.innerText='🎥 Follow Robot';
      }
      if (threeCanvasEl) threeCanvasEl.style.display = 'block';
      if (canvasEl) canvasEl.style.display = 'none';
      if (map3d) {
        map3d.setViewMode(mode);
        map3d.onResize();
      }
      if (mapControlsHint) {
        mapControlsHint.innerHTML = `
          <span class="hint-key">🚶 Walk</span> WASD / Arrows
          <span class="hint-sep">•</span>
          <span class="hint-key">👁️ Look 360°</span> Drag Mouse
        `;
      }
      threeCanvasEl?.focus({preventScroll:true});
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
      if(currentViewMode==='thirdPerson')switchViewMode('3d');
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
      if(currentViewMode==='thirdPerson')switchViewMode('3d');
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
      switchViewMode('3d');
    }
  });

  // -------------------------------------------------------------
  // STEP MODAL POPUP SYSTEM (Full-Screen Map -> Popup Workstation)
  // -------------------------------------------------------------
  const modalOverlay = document.getElementById('stepModalOverlay');
  const modalBadge = document.getElementById('modalStepBadge');
  const modalHeading = document.getElementById('modalStepHeading');
  const modalCloseBtn = document.getElementById('stepModalCloseBtn');
  const dashboardMenu = document.getElementById('dashboardMenu');
  const dashboardSteps = document.getElementById('dashboardSteps');
  const dashboardStepMenu = document.getElementById('dashboardStepMenu');
  const stepScrollLeft = document.getElementById('stepScrollLeft');
  const stepScrollRight = document.getElementById('stepScrollRight');
  function updateStepScroll() {
    const expanded = modalOverlay.style.display !== 'none';
    const maximum = dashboardSteps.scrollWidth - dashboardSteps.clientWidth;
    stepScrollLeft.hidden = !expanded || dashboardSteps.scrollLeft <= 1;
    stepScrollRight.hidden = !expanded || dashboardSteps.scrollLeft >= maximum - 1;
  }
  function scrollStepsToEdge(end) {
    stepScrollLeft.hidden = !end;
    stepScrollRight.hidden = end;
    dashboardSteps.scrollLeft = end ? dashboardSteps.scrollWidth : 0;
    updateStepScroll();
  }
  stepScrollLeft.addEventListener('click', () => scrollStepsToEdge(false));
  stepScrollRight.addEventListener('click', () => scrollStepsToEdge(true));
  dashboardSteps.addEventListener('scroll', updateStepScroll, { passive:true });
  new ResizeObserver(updateStepScroll).observe(dashboardSteps);
  const environmentSceneTools = document.getElementById('environmentSceneTools');
  const environmentSceneProgress = document.getElementById('environmentSceneProgress');
  const environmentSceneContinue = document.getElementById('environmentSceneContinue');
  environmentSceneProgress.querySelector('.environment-scene-checklist').innerHTML = ENVIRONMENT_ITEMS.map(item =>
    `<article class="environment-scene-item" data-scene-environment-category="${item.id}"><strong>${item.label}</strong><span class="environment-scene-count"></span></article>`
  ).join('');
  const dashboardBody = modalOverlay.querySelector('.step-modal-body');
  const stepButtons = dashboardSteps.querySelectorAll('[data-step]');
  let dashboardStep = 0;

  function updateDashboardMenu(step) {
    dashboardStep = step;
    const expanded = modalOverlay.style.display !== 'none';
    const parent = expanded ? dashboardBody.parentElement : dashboardMenu;
    if (dashboardStepMenu.parentElement !== parent) {
      const focused = dashboardSteps.contains(document.activeElement) ? document.activeElement : null;
      parent.insertBefore(dashboardStepMenu, expanded ? dashboardBody : null);
      focused?.focus({ preventScroll: true });
    }
    stepButtons.forEach(button => {
      const id = Number(button.dataset.step);
      button.disabled = id > 0 && (!appState.overviewStarted || !appState.canEnterStep(id) || (appState.sessionFinished && id !== 6));
      button.classList.toggle('active', id === step);
      if (id === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.setAttribute('aria-expanded', String(expanded && id === step));
    });
    requestAnimationFrame(updateStepScroll);
    document.getElementById('sensorAssemblyPreview').hidden = !expanded || ![3,4].includes(step) || appState.isRobotPovActive;
    const observing = step === 2 && !expanded && !appState.isRobotPovActive;
    environmentSceneTools.hidden = !observing;
    environmentSceneProgress.hidden = !observing;
    const progress = appState.getEnvironmentProgress();
    document.getElementById('environmentSceneTotal').textContent = `${progress.observed} / ${progress.total} observed`;
    environmentSceneProgress.querySelectorAll('[data-scene-environment-category]').forEach(item => {
      const status = appState.getEnvironmentProgress(item.dataset.sceneEnvironmentCategory);
      item.querySelector('.environment-scene-count').textContent = `${status.observed} / ${status.total}`;
    });
    environmentSceneProgress.classList.toggle('completed', appState.canContinue(2));
    environmentSceneContinue.hidden = !observing || !appState.canContinue(2);
  }

  const STEP_METADATA = {
    1: { badge: 'STEP 1 OF 6', heading: 'Set performance measurement' },
    2: { badge: 'STEP 2 OF 6', heading: 'Observe the environment' },
    3: { badge: 'STEP 3 OF 6', heading: 'Give your robot senses' },
    4: { badge: 'STEP 4 OF 6', heading: 'Give your robot a body' },
    5: { badge: 'STEP 5 OF 6', heading: 'Program your robot' },
    6: { badge: 'STEP 6 OF 6', heading: 'Run it' }
  };

  const roomViewport = document.getElementById('fullscreenHouseContainer');
  const topHeader = document.querySelector('.app-header');

  function setWorkstationLayout(open) {
    modalOverlay.classList.toggle('workstation-layout', open);
    document.body.classList.toggle('workstation-open', open);
  }

  new ResizeObserver(() => {
    document.body.style.setProperty('--workstation-top', `${topHeader.getBoundingClientRect().bottom + 10}px`);
  }).observe(topHeader);
  new ResizeObserver(() => {
    if (currentViewMode === 'fallback') houseCanvas.resizeCanvas();
    else map3d?.onResize();
  }).observe(roomViewport);

  function updateStepUi(step) {
    if(step!==5)blockCanvasView.setExpanded(false);
    const body=document.querySelector('.step-modal-body');
    body.classList.toggle('mounting-body',step===3 || step===4);
    body.classList.toggle('rule-body',step===5);
    modalOverlay?.classList.toggle('testing-layout',step === 6);
    setWorkstationLayout(modalOverlay.style.display !== 'none');
    document.getElementById('simFloatingHud').hidden = step !== 6 || Boolean(appState.sessionFinished);
    updateDashboardMenu(step);
    map3d?.setEnvironmentObservation(step===2);
    houseCanvas.setEnvironmentObservation(step===2);

    if (STEP_METADATA[step]) {
      if (modalBadge) modalBadge.hidden = false;
      if (modalBadge) modalBadge.innerText = `STAGE ${appState.currentStage} OF ${PILOT_STAGES.length} · ${STEP_METADATA[step].badge}`;
      if (modalHeading) modalHeading.innerText = STEP_METADATA[step].heading;
    }

    if (step === 5) {
      if (blockCanvasContainer) blockCanvasContainer.style.display = 'block';
      if (stepsPanelEl) stepsPanelEl.style.display = 'none';
      blockCanvasView.render();
    } else {
      if (blockCanvasContainer) blockCanvasContainer.style.display = 'none';
      if (stepsPanelEl) stepsPanelEl.style.display = 'block';
      stepsView.render();
    }
  }

  function showOverview() {
    blockCanvasView.setExpanded(false);
    if(appState.isRobotPovActive)povRenderer.exit();
    if(blockCanvasContainer)blockCanvasContainer.style.display='none';
    if(stepsPanelEl)stepsPanelEl.style.display='block';
    document.querySelector('.step-modal-body').classList.remove('mounting-body','rule-body');
    modalOverlay.classList.remove('testing-layout');
    setWorkstationLayout(true);
    map3d?.setEnvironmentObservation(false);
    houseCanvas.setEnvironmentObservation(false);
    modalBadge.textContent='';
    modalBadge.hidden=true;
    document.getElementById('simFloatingHud').hidden = true;
    modalHeading.textContent='Instructions';
    stepsView.renderOverview();
    modalOverlay.style.display='flex';
    updateDashboardMenu(0);
    dashboardBody.scrollTop = 0;
    appState.record('OVERVIEW_VIEWED','overview');
  }
  window.showOverview=showOverview;
  function openStepModal(stepNumber = dashboardStep) {
    if (stepNumber === 0 || !appState.overviewStarted) {
      showOverview();
      return;
    }
    if (appState.isRobotPovActive) povRenderer.exit();
    if (stepNumber !== undefined && stepNumber !== null) {
      if(appState.sessionFinished && stepNumber!==6)return;
      if(appState.currentStep===6 && stepNumber!==6)simEngine.endRun('revision');
      if (!appState.setStep(stepNumber)) return;
    }
    const fromOverview = dashboardStep === 0;
    modalOverlay.style.display = 'flex';
    updateStepUi(appState.currentStep);
    if (fromOverview) dashboardBody.scrollTop = 0;
  }

  function closeStepModal() {
    blockCanvasView.setExpanded(false);
    const restoreFocus = modalOverlay.contains(document.activeElement) || document.getElementById('sensorAssemblyPreview').contains(document.activeElement);
    modalOverlay.style.display = 'none';
    setWorkstationLayout(false);
    updateDashboardMenu(dashboardStep);
    if (restoreFocus) dashboardSteps.querySelector('[aria-current="step"]')?.focus({ preventScroll: true });
  }

  window.openStepModal = openStepModal;
  window.navigateStep = openStepModal;
  window.startRulePreview = () => { if (appState.currentStep === 5) simEngine.startPreview(); };
  window.closeStepModal = closeStepModal;

  modalCloseBtn?.addEventListener('click', closeStepModal);
  roomViewport.addEventListener('pointerdown', event => {
    if (modalOverlay.style.display !== 'none' &&
        (event.target === canvasEl || event.target === threeCanvasEl)) closeStepModal();
  }, true);
  environmentSceneTools.querySelectorAll('[data-environment-view]').forEach(button => {
    const views = { fps: 'walkEnvironment', thirdPerson: 'viewYourself', whole: 'viewWholeApartment' };
    button.addEventListener('click', () => stepsPanelEl.querySelector(`#${views[button.dataset.environmentView]}`)?.click());
  });
  environmentSceneContinue.addEventListener('click', () => openStepModal(2));

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeStepModal();
    }
  });

  stepButtons.forEach(button => {
    button.addEventListener('click', () => openStepModal(Number(button.dataset.step)));
  });

  for (const event of ['purposeChanged', 'environmentObservationChanged', 'sensorsChanged', 'actuatorsChanged', 'programChanged', 'rulesChanged']) {
    appState.on(event, () => updateDashboardMenu(dashboardStep));
  }

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

    if (e.key === ' ' && (e.target === document.body || e.target === canvasEl || e.target === threeCanvasEl)) {
      openStepModal();
      e.preventDefault();
    }
  });

  appState.on('stageChanged',()=>{
    simEngine.reset();
    updateStepUi(1);
    const stageLabel=`Task ${appState.currentStage} of ${PILOT_STAGES.length} · ${PILOT_STAGES[appState.currentStage-1].name}`;
    document.getElementById('stageProgress').textContent=stageLabel;
    document.getElementById('hudTaskName').textContent=stageLabel;
  });
  appState.record('STAGE_STARTED',String(appState.currentStage));

  appState.on('stepChanged', ({ step, oldStep }) => {
    if (oldStep === 5) simEngine.stopPreview();
    if (oldStep === 6 && step !== 6) simEngine.endRun('revision');
    if (step !== 6) document.getElementById('reflectionPanel')?.remove();
    updateStepUi(step);
    document.querySelector('.step-modal-body').scrollTop=0;
    if(step===5 && appState.canContinue(5))simEngine.startPreview();
    if(step===6)appState.notify('tick',{tick:simEngine.tickCount,scores:simEngine.scores,robot:world.robot});
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
    if(appState.sessionFinished || appState.currentStep!==6)return;
    if (appState.simRunning) {
      simEngine.stop();
      hudPlayPauseBtn.innerText = '▶';
      hudStatusDot?.classList.remove('running');
      hudStatusDot?.classList.add('paused');
      if (hudStatusText) hudStatusText.innerText = 'SIM PAUSED';
    } else {
      if (appState.currentStep !== 6) return;
      simEngine.start();
      sound.playEvent?.('run');
      hudPlayPauseBtn.innerText = '⏸';
      hudStatusDot?.classList.add('running');
      hudStatusDot?.classList.remove('paused');
      if (hudStatusText) hudStatusText.innerText = 'SIM RUNNING';
    }
  });

  hudResetBtn?.addEventListener('click', () => {
    if(appState.sessionFinished || appState.currentStep!==6)return;
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
    openStepModal(6);
  });

  function updateHudEvidence() {
    if (hudTickText) hudTickText.innerText = `Tick ${simEngine.tickCount}`;
    const criteria = document.getElementById('hudCriteria');
    if (criteria) criteria.textContent = simEngine.criteriaResults.map(c=>`${c.observed}: ${c.status}`).join(' · ') + ` · ${simEngine.elapsedSeconds.toFixed(1)} seconds elapsed`;
  }
  appState.on('tick', () => {
    updateHudEvidence();
    if(appState.currentStep===5){const preview=document.getElementById('ruleApartmentPreview');if(preview)preview.getContext('2d').drawImage(canvasEl,0,0,preview.width,preview.height);}
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
  if (appState.localPreview) {
    appState.overviewStarted = true;
    if (preview === 'logic' || preview === 'logic-answer') {
      appState.setTaskPriority('TASK_1','thorough');
      for (const id of ['SENSE_07','SENSE_04','SENSE_01','SENSE_09','SENSE_02','SENSE_03']) appState.toggleSensor(id);
      for (const id of ['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ESTOP','ACTUATOR_DOCK_PIN']) appState.toggleActuator(id);
    }
    if (preview === 'logic-answer') {
      const {createLogicAnswerWorkspace}=await import('./view/logic-answer-preview.js');
      appState.setTaskPriority('TASK_1','speed');
      appState.blockWorkspace=createLogicAnswerWorkspace();
      blockCanvasView.answerPreview=true;
    }
    openStepModal(preview === 'logic' || preview === 'logic-answer' ? 5 : 3);
    if (preview === 'logic-answer') {
      simEngine.stopPreview();
      blockCanvasView.setExpanded(true);
      blockCanvasView.workspace.setScale(.8);
      blockCanvasView.workspace.scroll(0,0);
    }
    document.title = 'PEASLab2D · Local preview';
  } else showOverview();

  console.log('🚀 PEASLab2D Initialized for Individual Learning.');
});
