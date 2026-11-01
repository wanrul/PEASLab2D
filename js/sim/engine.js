/**
 * CollabPEAS - 10Hz Simulation Engine & Rule Evaluator
 * Evaluates unlocked task rules and factual criterion evidence.
 * Keeps legacy private score diagnostics separate from pilot feedback and passage.
 */

import { appState } from '../state.js';
import { ACTION_BLOCKS, CONDITION_BLOCKS, SENSE_BLOCKS } from '../data/blocks.js';
import { sound } from '../view/audio.js';
import { STAGE_CRITERIA, SIMULATION_SETTINGS, criterionDescriptions } from '../pilot-config.js';

// Private legacy diagnostics only. Active pilot criteria are in pilot-config.js.
export const SCORE_CONSTANTS = Object.freeze({ dirtShare: 0.7, objectShare: 0.3, catPenalty: 8, humanPenalty: 5, liquidPenalty: 25, runLimitSeconds: 120, waitTicks: 20 });
export const scoreDefinitions = Object.freeze({
  coverage: '70% cleaned dirt cells + 30% correctly sorted objects.',
  safety: '100 − 8 per cat near-miss − 5 per fast pass near a person (minimum 0).',
  time: '100 within the run limit; minus 100 × overtime / run limit afterward. Simulation time; provisional 120-second pilot limit.',
  hazard: 'Percentage of spills mopped − 25 per vacuum-on-spill encounter (minimum 0).',
  composite: 'Total = Σ (dimension weight / 100) × dimension score.'
});

export class SimulationEngine {
  constructor(world, { runLimitSeconds = SCORE_CONSTANTS.runLimitSeconds, criteria = STAGE_CRITERIA, simulationSettings = SIMULATION_SETTINGS } = {}) {
    this.world = world;
    this.criteria = criteria;
    this.simulationSettings = { ...SIMULATION_SETTINGS, ...simulationSettings };
    this.runLimitSeconds = runLimitSeconds;
    this.scoreDefinitions = { ...scoreDefinitions, time: `100 within ${runLimitSeconds} simulation seconds; minus 100 × overtime / ${runLimitSeconds} afterward. Provisional, uncalibrated pilot limit.` };
    this.runId = 0;
    this.runActive = false;
    this.tickInterval = null;
    this.tickRateHz = 10;
    this.resetRuntime();
  }

  resetRuntime() {
    this.tickCount = 0;
    this.elapsedSeconds = 0;
    this.runStartTick = 0;
    this.catSafetyViolations = 0;
    this.humanSafetyViolations = 0;
    this.vacuumLiquidMistakes = 0;
    this.vacuumTicks = 0;
    this.mopTicks = 0;
    this.pickups = 0;
    this.releases = 0;
    this.wrongReleases = 0;
    this.catOpportunities = 0;
    this.humanOpportunities = 0;
    this.catResponses = 0;
    this.humanResponses = 0;
    this.movingTicks = 0;
    this.previousMoving = false;
    this.encounters = { cat: false, human: false, catViolation: false, humanViolation: false, catResponse: false, humanResponse: false, wet: [] };
    this.ruleRuntime = {};
    this.pendingThen = [];
    this.rulesRevision = appState.rulesRevision;
    this.firedTasks = new Set();
    this.dockRequested = false;
    this.reachedDock = false;
    this.dockedAtBattery = null;
    this.completionSeconds = null;
    this.functionalCompletionSeconds = null;
    this.activeRuleFired = null;
    this.lastAction = null;
    this.lastTrace = { sense: null, decide: null, act: null };
    this.reflectionShown = false;
    this.reflexTicks = 0;
    this.navigationGrid = null;
    this.coverageGrid = null;
    this.navigationRoute = null;
    this.perceivedObjects = new Map();
    this.perceivedDirt = new Map();
    this.perceivedWet = new Map();
    this.coverageVisited = new Set();
    this.enteredCells = new Set();
    this.explorationTarget = null;
    this.selectedGoal = null;
    this.goalSelections = [];
    this.lowBatteryEncounter = false;
    this.lowBatteryGoalSelected = false;
    this.lowBatteryTravelTicks = 0;
    this.humanResumes = 0;
    this.humanResumePending = false;
    this.humanNearSpeeds = [];
    this.cleanVacuumTicks = 0;
    this.inspectionTicks = 0;
    this.tickStart = null;
    this.explicitMotion = false;
    this.finalOutcomes = false;
    this.scores = {};
    this.computeScores();
    this.updateOutcomes();
  }

  start(options = {}) {
    if (appState.sessionFinished) return;
    if (!options.preview && this.previewActive) this.stopPreview();
    if (this.tickInterval) return;
    if (!options.preview && !this.runActive) {
      this.world.reset();
      this.resetRuntime();
      appState.simTick = 0;
      this.runActive = true;
      this.runId++;
      this.runStageId = appState.currentStage;
      this.runConfiguration = appState.getConfiguration();
      this.runBaseline = { ...this.scores }; // Private legacy diagnostic only.
      this.clearReflection();
      appState.record('RUN_STARTED', String(this.runId), { runId: this.runId, configuration: this.runConfiguration, criteria: { ...this.criteria[this.runStageId] }, simulationSettings:{...this.simulationSettings} }, 5);
    }
    appState.simRunning = true;
    const intervalMs = 1000 / (this.tickRateHz * appState.simSpeed);
    this.tickInterval = setInterval(() => this.tick(), intervalMs);
    appState.notify('simStateChanged', { running: true });
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    appState.simRunning = false;
    appState.notify('simStateChanged', { running: false });
  }

  startPreview() {
    if (appState.sessionFinished || this.previewActive || this.runActive) return;
    // Save references as well as values: renderers retain the world and its
    // entities, so restoring must preserve their identities and aliases.
    const graph = [];
    const seen = new Set();
    const capture = object => {
      if (!object || typeof object !== 'object' || seen.has(object)) return;
      seen.add(object);
      const values = { ...object };
      graph.push({ object, values, length: Array.isArray(object) ? object.length : null });
      Object.values(values).forEach(capture);
    };
    capture(this.world);
    const counters = {};
    for (const key of Object.keys(this)) {
      if (['world', 'tickInterval', 'previewSnapshot'].includes(key)) continue;
      counters[key] = structuredClone(this[key]);
    }
    this.previewSnapshot = { graph, counters, simTick: appState.simTick };
    this.previewActive = true;
    this.start({ preview: true });
  }

  stopPreview() {
    if (!this.previewActive) return;
    this.stop();
    const { graph, counters, simTick } = this.previewSnapshot;
    for (const { object, values, length } of graph) {
      for (const key of Object.keys(object)) if (!(key in values)) delete object[key];
      for (const [key, value] of Object.entries(values)) if (object[key] !== value) object[key] = value;
      if (length !== null) object.length = length;
    }
    Object.assign(this, counters);
    appState.simTick = simTick;
    this.previewSnapshot = null;
    this.previewActive = false;
  }

  clearReflection() {
    appState.reflectionPrompt = null;
    appState.notify('reflectionSelected', { cleared: true });
  }

  pause() { this.stop(); }

  endRun(reason = 'finish') {
    this.stopPreview();
    this.stop();
    if (!this.runActive) return null;
    this.clearReflection();
    this.updateOutcomes(true);
    this.computeScores();
    const tasksCompleted = this.taskOutcomes.filter(t => t.status === 'done').map(t => t.taskId);
    const snapshot = { runId: this.runId, stageId: this.runStageId, taskIds: [...appState.selectedTasks],
      passed: this.criteriaResults.every(criterion => criterion.status === 'Achieved'),
      criteria: structuredClone(this.criteriaResults), criteriaSettings: { ...this.criteria[this.runStageId] }, simulationSettings:{...this.simulationSettings},
      configuration: structuredClone(this.runConfiguration), tasksCompleted,
      outcomes: structuredClone(this.taskOutcomes), tick: this.tickCount, reason,
      counters: { dirtCleaned: this.world.dirtCells.filter(d=>d.cleaned).length, dirtTotal: this.world.dirtCells.length,
        ...(appState.selectedTasks.includes('TASK_2') ? { objectsSorted: this.world.objects.filter(o=>o.sorted).length, objectsTotal: this.world.objects.length, pickups: this.pickups, releases: this.releases, wrongReleases: this.wrongReleases } : {}),
        catNearMisses: this.catSafetyViolations, fastPersonPasses: this.humanSafetyViolations, vacuumSpillEvents: this.vacuumLiquidMistakes,
        spillsMopped:this.world.wetCells.filter(w=>w.cleaned).length,spillsTotal:this.world.wetCells.length,
        inspectionSeconds:this.inspectionTicks/this.tickRateHz,cleanVacuumSeconds:this.cleanVacuumTicks/this.tickRateHz,
        catEncounters:this.catOpportunities,catStops:this.catResponses,humanEncounters:this.humanOpportunities,humanSlowResponses:this.humanResponses,humanResumes:this.humanResumes,
        humanNearSpeeds:[...new Set(this.humanNearSpeeds)],dockedAtBattery:this.dockedAtBattery,lowBatteryEncounter:this.lowBatteryEncounter,lowBatteryTravelTicks:this.lowBatteryTravelTicks },
      sensingMemory:{dirt:[...this.perceivedDirt.values()],wet:[...this.perceivedWet.values()],objects:[...this.perceivedObjects.values()],coverage:[...this.coverageVisited],enteredCells:[...this.enteredCells]},
      goalSelections:structuredClone(this.goalSelections),
      elapsedSeconds: this.elapsedSeconds, durationMs: this.elapsedSeconds * 1000 };
    appState.retainRun(snapshot);
    appState.record('RUN_ENDED', String(this.runId), snapshot, 5);
    appState.notify('runEnded', snapshot);
    this.runActive = false;
    if (!snapshot.passed && !this.reflectionShown) {
      this.reflectionShown = true;
      const prompt = { runId: this.runId, stageId: this.runStageId, taskIds: snapshot.taskIds,
        unmet: snapshot.criteria.filter(c => c.status !== 'Achieved').map(c => c.label), shownAt: Date.now() };
      appState.reflectionPrompt = prompt;
      appState.record('REFLECTION_SHOWN', String(this.runId), prompt, 5);
      appState.notify('reflectionNeeded', prompt);
    }
    return snapshot;
  }

  setSpeed(speedMultiplier) {
    appState.simSpeed = speedMultiplier;
    if (this.tickInterval) {
      this.stop();
      this.start({ preview: this.previewActive });
    }
  }

  reset() {
    this.endRun('reset');
    this.clearReflection();
    this.world.reset();
    this.finalOutcomes = false;
    this.resetRuntime();
    appState.simTick = 0;
    appState.notify('simReset', {});
  }

  tick() {
    this.tickCount++;
    appState.simTick = this.tickCount;
    if (this.runActive) this.elapsedSeconds = (this.tickCount - this.runStartTick) / this.tickRateHz;
    const robot = this.world.robot;
    this.tickStart = { x: robot.x, y: robot.y };
    this.explicitMotion = false;
    // Emergency stop is a one-tick action, so a cleared condition permits exploration again.
    robot.isStopped = false;
    this.updateCat();
    const percepts = this.readSensors();
    const decision = this.evaluateRules(percepts);
    if (appState.installedSensors.has('SENSE_07')) this.observeCoverage();
    this.activeRuleFired = decision;
    if (decision) {
      const executed = this.executeAction(decision);
      if (executed !== false) this.firedTasks.add(decision.taskId);
      appState.record('RULE_FIRED', decision.ruleId, { tick: this.tickCount, runId: this.runActive ? this.runId : null, preview: Boolean(this.previewActive), taskId: decision.taskId, ruleId: decision.ruleId, ...decision.trace, executed: executed !== false });
    } else this.lastAction = null;
    this.drive(percepts);
    this.updateRobotPhysics();
    this.updateOutcomes();
    this.computeScores();
    appState.notify('tick', { tick: this.tickCount, scores: this.scores, outcomes: this.taskOutcomes, percepts, robot, cat: this.world.cat, avatar: this.world.avatar });
  }

  updateCat() {
    const cat = this.world.cat;
    if (cat.state === 'pause') {
      cat.pauseTimer--;
      if (cat.pauseTimer <= 0) {
        cat.state = 'walk';
        cat.targetIndex = (cat.targetIndex + 1) % cat.patrolTargets.length;
      }
      return;
    }

    const target = cat.patrolTargets[cat.targetIndex];
    const dx = target.x - cat.x;
    const dy = target.y - cat.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      cat.state = 'pause';
      cat.pauseTimer = this.simulationSettings.catDwellTicks; // Deterministic 2.5-second dwell for comparable pilot resets.
    } else {
      cat.heading = Math.atan2(dy, dx);
      const move = this.world.resolveMove(cat.x,cat.y,Math.cos(cat.heading)*cat.speed,Math.sin(cat.heading)*cat.speed,cat.radius);
      cat.x=move.x; cat.y=move.y;
      if(!move.moved) cat.targetIndex=(cat.targetIndex+1)%cat.patrolTargets.length;
    }
  }

  readSensors() {
    const robot = this.world.robot;
    const cat = this.world.cat;
    const avatar = this.world.avatar;
    const installed = appState.installedSensors;

    const percepts = {};

    // SENSE_01: Animal Detection
    if (installed.has('SENSE_01')) {
      const distToCat = Math.hypot(robot.x - cat.x, robot.y - cat.y);
      // 1.5m in world pixels is ~90px
      percepts.SENSE_01 = distToCat <= 90 ? 'DETECTED' : 'CLEAR';
      percepts.catDistancePx = distToCat;
    } else {
      percepts.SENSE_01 = 'NOT_INSTALLED';
    }

    // SENSE_02: Battery Sensor
    if (installed.has('SENSE_02')) {
      if (robot.battery < this.lowBatteryPercent) percepts.SENSE_02 = 'LOW';
      else if (robot.battery > 60) percepts.SENSE_02 = 'HIGH';
      else percepts.SENSE_02 = 'MED';
    } else {
      percepts.SENSE_02 = 'NOT_INSTALLED';
    }

    // SENSE_03: Destination Sensor (learner-selected BIN/TABLE/DOCK)
    if (installed.has('SENSE_03')) {
      const destination = this.destination();
      const distance = destination ? Math.hypot(robot.x - destination.x, robot.y - destination.y) : null;
      percepts.SENSE_03 = destination ? { ...destination, distance, dockDist: destination.target === 'DOCK' ? distance : null, reached: distance < 30, far: distance > 120 } : { target: null, reached: false, far: false };
    } else {
      percepts.SENSE_03 = 'NOT_INSTALLED';
    }

    // SENSE_04: Distance Sensor (4 directions)
    if (installed.has('SENSE_04')) {
      const frontDist = this.raycastObstacle(robot.x, robot.y, robot.heading);
      if (frontDist < 35) percepts.SENSE_04 = 'BLOCKED';
      else if (frontDist < 90) percepts.SENSE_04 = 'NEAR';
      else percepts.SENSE_04 = 'FAR';
      percepts.frontRayDist = frontDist;
    } else {
      percepts.SENSE_04 = 'NOT_INSTALLED';
    }

    // SENSE_05: Floor Dirt Sensor
    if (installed.has('SENSE_05')) {
      const onDirt = this.world.dirtCells.some(d => !d.cleaned && Math.hypot(robot.x - d.x, robot.y - d.y) < d.radius + 10);
      percepts.SENSE_05 = onDirt ? 'DIRTY' : 'CLEAN';
      if (installed.has('SENSE_07')) for (const d of this.world.dirtCells) {
        if (Math.hypot(robot.x-d.x,robot.y-d.y)<d.radius+10) this.perceivedDirt.set(d.id,{id:d.id,x:d.x,y:d.y,radius:d.radius,cleaned:d.cleaned});
      }
    } else {
      percepts.SENSE_05 = 'NOT_INSTALLED';
    }

    // SENSE_06: Floor Wet Sensor
    if (installed.has('SENSE_06')) {
      const onWet = this.world.wetCells.some(w => !w.cleaned && Math.hypot(robot.x - w.x, robot.y - w.y) < w.radius + 10);
      percepts.SENSE_06 = onWet ? 'WET' : 'DRY';
      if (installed.has('SENSE_07')) for (const w of this.world.wetCells) {
        if (Math.hypot(robot.x-w.x,robot.y-w.y)<w.radius+10) this.perceivedWet.set(w.id,{id:w.id,x:w.x,y:w.y,radius:w.radius,cleaned:w.cleaned});
      }
    } else {
      percepts.SENSE_06 = 'NOT_INSTALLED';
    }

    // SENSE_07: Floor Map Sensor
    if (installed.has('SENSE_07')) {
      percepts.SENSE_07 = 'LAYOUT_AND_OBSERVATIONS';
      // Static geometry supports coverage; task-cell coordinates require a mounted local channel.
      percepts.mapCellUnvisited = !this.enteredCells.has(this.currentCoverageCell());
      percepts.mapCoverage = [...this.coverageVisited];
      if (installed.has('SENSE_05')) percepts.mapDirt = [...this.perceivedDirt.values()].filter(d=>!d.cleaned);
      if (installed.has('SENSE_06')) percepts.mapWet = [...this.perceivedWet.values()].filter(w=>!w.cleaned);
    } else {
      percepts.SENSE_07 = 'NOT_INSTALLED';
    }

    // SENSE_08: Grip Sensor
    if (installed.has('SENSE_08')) {
      percepts.SENSE_08 = robot.heldObject ? 'GRIPPING' : 'EMPTY';
    } else {
      percepts.SENSE_08 = 'NOT_INSTALLED';
    }

    // SENSE_09: Human Proximity Sensor
    if (installed.has('SENSE_09')) {
      const distToAvatar = Math.hypot(robot.x - avatar.x, robot.y - avatar.y);
      // 2.0m is ~120px
      percepts.SENSE_09 = distToAvatar <= 120 ? 'NEAR' : 'CLEAR';
      percepts.avatarDistancePx = distToAvatar;
    } else {
      percepts.SENSE_09 = 'NOT_INSTALLED';
    }

    // The world has no calibrated lighting or object-mass model. Keep that
    // distinction visible instead of inventing physical measurements.
    if (installed.has('SENSE_10')) {
      percepts.SENSE_10 = Number.isFinite(this.world.ambientLux) ? this.world.ambientLux : 'NOT_MODELLED';
    } else percepts.SENSE_10 = 'NOT_INSTALLED';

    if (installed.has('SENSE_11')) {
      percepts.SENSE_11 = !robot.heldObject ? 0 :
        Number.isFinite(robot.heldObject.weightGrams) ? robot.heldObject.weightGrams : 'NOT_MODELLED';
    } else percepts.SENSE_11 = 'NOT_INSTALLED';

    if (installed.has('SENSE_13')) {
      percepts.SENSE_13 = robot.vacuumActive || this.lastAction === 'ACT_22' || this.lastAction === 'ACT_23' ? 'LOUD' : 'QUIET';
    } else percepts.SENSE_13 = 'NOT_INSTALLED';

    // This apartment is a single flat floor with no modeled stair drop-offs.
    percepts.SENSE_14 = installed.has('SENSE_14') ? 'CLEAR' : 'NOT_INSTALLED';

    // SENSE_12: Session Timer
    if (installed.has('SENSE_12')) {
      percepts.SENSE_12 = (this.runActive ? this.elapsedSeconds : this.tickCount / this.tickRateHz).toFixed(1);
    } else {
      percepts.SENSE_12 = 'NOT_INSTALLED';
    }

    // SENSE_15: Vision Sensor (120° cone)
    if (installed.has('SENSE_15')) {
      const visible = this.world.objects.filter(obj => {
        if (obj.disposed || obj.carried) return false;
        const dx = obj.x - robot.x;
        const dy = obj.y - robot.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 180) return false; // cone range
        const angleToObj = Math.atan2(dy, dx);
        let diff = Math.abs(angleToObj - robot.heading);
        while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
        return diff <= (Math.PI / 3); // 60 deg each side = 120 deg
      }).sort((a,b) => Math.hypot(a.x-robot.x,a.y-robot.y)-Math.hypot(b.x-robot.x,b.y-robot.y))[0];
      percepts.SENSE_15 = robot.heldObject?.type || visible?.type || 'NONE';
      percepts.visibleObject = visible;
      if (appState.selectedTasks.includes('TASK_2')) {
        if (visible) this.perceivedObjects.set(visible.id, { id:visible.id, x:visible.x, y:visible.y, type:visible.type });
        percepts.rememberedObjects = [...this.perceivedObjects.values()];
      }
    } else {
      percepts.SENSE_15 = 'NOT_INSTALLED';
    }

    return percepts;
  }

  raycastObstacle(ox, oy, angle) {
    const step = 8;
    const maxDist = 250;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let d = 15; d < maxDist; d += step) {
      const px = ox + cos * d;
      const py = oy + sin * d;
      if (this.world.checkCollision(px, py, 6)) {
        return d;
      }
    }
    return maxDist;
  }

  destination() {
    const stations = { BIN: this.world.smartBin, TABLE: this.world.depositTable, DOCK: this.world.dock };
    return stations[this.selectedGoal] ? { ...stations[this.selectedGoal], target: this.selectedGoal } : null;
  }

  actionAlreadySatisfied(action) {
    const r=this.world.robot;
    return ({ ACT_07:r.isSlow, ACT_08:!r.isSlow, ACT_09:r.vacuumActive, ACT_10:!r.vacuumActive,
      ACT_11:r.mopDeployed, ACT_12:!r.mopDeployed, ACT_13:r.armExtended, ACT_16:!r.armExtended, ACT_14:Boolean(r.heldObject), ACT_15:!r.heldObject && !r.gripperClosed,
      ACT_17:r.isDocked, ACT_24:this.selectedGoal==='BIN', ACT_25:this.selectedGoal==='TABLE', ACT_26:this.selectedGoal==='DOCK'
    })[action] || false;
  }

  conditionPassed(sense, condition, p) {
    if (!condition) return true;
    if (!CONDITION_BLOCKS.find(b => b.id === condition)?.requiresSense.includes(sense)) return false;
    return ({
      COND_01: p.SENSE_04 === 'NEAR', COND_02: p.SENSE_04 === 'BLOCKED',
      COND_03: p.SENSE_05 === 'DIRTY', COND_04: p.SENSE_06 === 'WET',
      COND_05: p.mapCellUnvisited === true,
      COND_06: sense === 'SENSE_05' ? p.SENSE_05 === 'CLEAN' : appState.installedSensors.has('SENSE_05') && p.SENSE_05 === 'CLEAN',
      COND_07: p.SENSE_01 === 'DETECTED', COND_08: p.SENSE_02 === 'LOW', COND_09: p.SENSE_02 === 'HIGH',
      COND_10: p.SENSE_03?.reached, COND_11: p.SENSE_03?.far,
      COND_12: p.SENSE_09 === 'NEAR', COND_13: p.SENSE_09 === 'CLEAR',
      COND_14: p.SENSE_08 === 'GRIPPING', COND_15: p.SENSE_08 === 'EMPTY',
      COND_16: p.SENSE_15 === 'TRASH', COND_17: ['CUP','FOOD'].includes(p.SENSE_15),
      COND_18: Number.isFinite(this.criteria[appState.currentStage].speedLimitSeconds) && Number(p.SENSE_12) > this.criteria[appState.currentStage].speedLimitSeconds,
      COND_19: p.SENSE_14 === 'EDGE DETECTED', COND_20: typeof p.SENSE_11 === 'number' && p.SENSE_11 > 0,
      COND_21: p.SENSE_06 === 'DRY', COND_22: p.SENSE_01 === 'CLEAR'
    })[condition] || false;
  }

  evaluateRules(percepts) {
    // Editing configuration restarts controls, including after a preview restores
    // a runtime snapshot. Pausing/resuming does not change the revision.
    if (this.rulesRevision !== appState.rulesRevision) {
      this.ruleRuntime = {};
      this.pendingThen = [];
      this.rulesRevision = appState.rulesRevision;
    }
    const candidates = [];
    let inspected = null;
    for (let i=0; i<appState.rules.length; i++) {
      const rule = appState.rules[i], { sense, condition, action, control } = rule.slots;
      if (!appState.selectedTasks.includes(rule.taskId) || !sense || !action) continue;
      if (!appState.installedSensors.has(sense)) {
        inspected ||= { sense: `${SENSE_BLOCKS.find(b=>b.id===sense)?.name || sense} — not mounted`, decide: 'Rule did not fire', act: null };
        delete this.ruleRuntime[rule.id];
        continue;
      }
      if (!this.conditionPassed(sense,condition,percepts)) { delete this.ruleRuntime[rule.id]; continue; }
      // A setting yields when it and its optional THEN are satisfied. Repeated STOP
      // remains active; queued THEN keeps its original priority and next-tick order.
      if (this.actionAlreadySatisfied(action) && (!rule.slots.secondaryAction || this.actionAlreadySatisfied(rule.slots.secondaryAction))) continue;
      const signature = JSON.stringify(rule.slots);
      if (this.ruleRuntime[rule.id]?.signature !== signature) this.ruleRuntime[rule.id] = { signature, since: this.tickCount };
      if (control === 'CTRL_03' && this.tickCount-this.ruleRuntime[rule.id].since < SCORE_CONSTANTS.waitTicks) {
        inspected ||= { sense, decide: 'Waiting 2 seconds', act: null }; continue;
      }
      candidates.push({ ruleIndex:i, ruleId:rule.id, taskId:rule.taskId, taskName:rule.taskName, action, priority:rule.slots.priority==='CTRL_05'?10:1, trace:{sense,condition,action,control,ruleId:rule.id,taskId:rule.taskId} });
    }
    this.pendingThen = this.pendingThen.filter(q => {
      q.ruleIndex = appState.rules.findIndex(rule => rule.id === q.ruleId);
      const slots = appState.rules[q.ruleIndex]?.slots;
      return Boolean(slots) && appState.selectedTasks.includes(appState.rules[q.ruleIndex].taskId) && JSON.stringify(slots) === q.signature && appState.installedSensors.has(slots.sense);
    });
    for (const queued of this.pendingThen) {
      if (queued.due <= this.tickCount) candidates.push(queued);
    }
    candidates.sort((a,b)=>b.priority-a.priority || Number(Boolean(b.secondary))-Number(Boolean(a.secondary)) || a.ruleIndex-b.ruleIndex);
    const winner = candidates[0] || null;
    if (winner?.secondary) this.pendingThen = this.pendingThen.filter(q=>q!==winner);
    this.lastTrace = winner ? { ...winner.trace } : inspected || {sense:null,decide:'Exploring',act:null};
    this.world.robot.traceState = this.lastTrace;
    return winner;
  }

  executeAction(decision) {
    const robot = this.world.robot, act = decision.action;
    this.lastTrace = { ...decision.trace };
    this.world.robot.traceState = this.lastTrace;
    const rule = decision.ruleId ? appState.rules.find(rule => rule.id === decision.ruleId) : appState.rules[decision.ruleIndex];
    const slots = rule?.slots;
    if (!decision.secondary && slots?.control === 'CTRL_04' && slots.secondaryAction && !this.pendingThen.some(q=>q.ruleId===rule.id)) {
      this.pendingThen.push({ ...decision, action:slots.secondaryAction, secondary:true, signature:JSON.stringify(slots), due:this.tickCount+1, trace:{...decision.trace,action:slots.secondaryAction} });
    }
    const required = ACTION_BLOCKS.find(b=>b.id===act)?.requiresActuator;
    const missingDrive = ['ACT_01','ACT_02'].includes(act) && !appState.installedActuators.has('ACTUATOR_ROTATION');
    if ((!required && !['ACT_24','ACT_25','ACT_26'].includes(act)) || (required && !appState.installedActuators.has(required)) || missingDrive) {
      this.lastTrace.act = `${ACTION_BLOCKS.find(b=>b.id===act)?.name || act} — no actuator`;
      return false;
    }
    const changed = this.lastAction !== act;
    this.lastAction = act;
    switch(act) {
      case 'ACT_01': this.explicitMotion = true; this.moveRobot(1); break;
      case 'ACT_02': this.explicitMotion = true; this.moveRobot(-0.6); break;
      case 'ACT_03': robot.heading -= Math.PI/2; this.explicitMotion = true; break;
      case 'ACT_04': robot.heading += Math.PI/2; this.explicitMotion = true; break;
      case 'ACT_05': robot.heading += Math.PI; this.explicitMotion = true; break;
      case 'ACT_06': robot.isStopped = true; break;
      case 'ACT_07': robot.isSlow = true; break;
      case 'ACT_08': robot.isSlow = false; break;
      case 'ACT_09': robot.vacuumActive = true; break;
      case 'ACT_10': robot.vacuumActive = false; break;
      case 'ACT_11': robot.mopDeployed = true; break;
      case 'ACT_12': robot.mopDeployed = false; break;
      case 'ACT_13': robot.armExtended = true; break;
      case 'ACT_14': {
        robot.gripperClosed = true;
        if (robot.armExtended && !robot.heldObject) {
          const obj = this.world.objects.filter(o=>!o.carried&&!o.disposed&&Math.hypot(o.x-robot.x,o.y-robot.y)<45).sort((a,b)=>Math.hypot(a.x-robot.x,a.y-robot.y)-Math.hypot(b.x-robot.x,b.y-robot.y))[0];
          if (obj) { robot.heldObject=obj; obj.carried=true; this.perceivedObjects.delete(obj.id); this.pickups++; }
        }
        break;
      }
      case 'ACT_15': {
        robot.gripperClosed = false;
        const obj = robot.heldObject;
        if (obj) {
          const target = obj.type==='TRASH'?this.world.smartBin:this.world.depositTable;
          const correct = Math.hypot(robot.x-target.x,robot.y-target.y)<40;
          Object.assign(obj,{x:robot.x,y:robot.y,carried:false,disposed:correct,sorted:correct});
          this.releases++;
          if (correct && obj.type==='TRASH') this.world.smartBin.isOpen = true;
          if (!correct) {
            this.wrongReleases++;
            this.perceivedObjects.set(obj.id, { id:obj.id, x:obj.x, y:obj.y, type:obj.type });
          }
          robot.heldObject=null;
          this.selectedGoal=null;
        }
        break;
      }
      case 'ACT_16': robot.armExtended=false; break;
      case 'ACT_17':
        if (Math.hypot(robot.x-this.world.dock.x,robot.y-this.world.dock.y)<30 && robot.battery>0) {
          this.dockedAtBattery ??= robot.battery;
          robot.isDocked=true; robot.isCharging=true;
        }
        break;
      case 'ACT_24':
      case 'ACT_25':
      case 'ACT_26': {
        this.selectedGoal = {ACT_24:'BIN',ACT_25:'TABLE',ACT_26:'DOCK'}[act];
        this.goalSelections.push({tick:this.tickCount,goal:this.selectedGoal,battery:robot.battery});
        if (this.selectedGoal==='DOCK') {
          this.dockRequested=true;
          if (this.lowBatteryEncounter) this.lowBatteryGoalSelected=true;
        }
        break;
      }
      case 'ACT_18': robot.ledColor='rgba(239, 68, 68, 0.95)'; break;
      case 'ACT_19': robot.ledColor='rgba(245, 158, 11, 0.95)'; break;
      case 'ACT_20': robot.ledColor='rgba(59, 130, 246, 0.95)'; break;
      case 'ACT_21': this.world.smartBin.isOpen=true; break;
      case 'ACT_22': if(changed) sound.playBeep(); break;
      case 'ACT_23': if(changed) sound.playChime(); break;
    }
    return true;
  }

  canDrive() {
    return appState.installedActuators.has('ACTUATOR_WHEELS') && appState.installedActuators.has('ACTUATOR_ROTATION') && !this.world.robot.isDocked && this.world.robot.battery>0;
  }

  moveRobot(direction=1) {
    if (!this.canDrive() || this.world.robot.isStopped) return;
    const r = this.world.robot, speed = (r.isSlow ? 1 : r.speed)*direction;
    const move = this.world.resolveMove(r.x,r.y,Math.cos(r.heading)*speed,Math.sin(r.heading)*speed,r.radius);
    if(move.moved) { r.x=move.x; r.y=move.y; }
    else {
      r.heading += Math.PI/3;
      this.reflexTicks = 12;
      this.lastTrace.act = `${this.lastTrace.act ? this.lastTrace.act + '; ' : ''}built-in reflex — collision stop and turn`;
    }
  }

  drive(p) {
    const r = this.world.robot;
    if (!this.canDrive() || r.isStopped || this.explicitMotion) return;
    let targets = [];
    if (appState.installedSensors.has('SENSE_03') && p.SENSE_03?.target && ((appState.selectedTasks.includes('TASK_2') && r.heldObject && ['BIN','TABLE'].includes(p.SENSE_03.target)) || (appState.selectedTasks.includes('TASK_6') && p.SENSE_03.target==='DOCK'))) targets = [p.SENSE_03];
    else {
      if (appState.installedSensors.has('SENSE_07') && appState.installedSensors.has('SENSE_05') && appState.selectedTasks.includes('TASK_1') && p.mapDirt) targets.push(...p.mapDirt);
      if (appState.installedSensors.has('SENSE_07') && appState.installedSensors.has('SENSE_06') && appState.selectedTasks.includes('TASK_3') && p.mapWet) targets.push(...p.mapWet);
      if (appState.selectedTasks.includes('TASK_2') && !r.heldObject) {
        if (appState.installedSensors.has('SENSE_15') && p.visibleObject) targets.push(p.visibleObject);
        if (appState.installedSensors.has('SENSE_15') && p.rememberedObjects) targets.push(...p.rememberedObjects);
      }
      // Underfoot channels never reveal distant cells.
    }
    if (!targets.length && appState.installedSensors.has('SENSE_07')) {
      const exploration=this.nextExplorationTarget();
      if(exploration) targets.push(exploration);
    }
    // Keep a still-perceived goal while following its doorway route: switching
    // on straight-line distance mid-detour can oscillate between two rooms.
    const routedTarget = targets.find(goal => `${goal.x},${goal.y}` === this.navigationRoute?.key);
    const target = routedTarget || targets.sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y))[0];
    if(this.reflexTicks>0) this.reflexTicks--;
    else if(target && Math.hypot(target.x-r.x,target.y-r.y)>5) {
      const waypoint=this.routeTo(target);
      if(waypoint) r.heading=Math.atan2(waypoint.y-r.y,waypoint.x-r.x);
    }
    if(!target)this.navigationRoute=null;
    if (!target || Math.hypot(target.x-r.x,target.y-r.y)>5) this.moveRobot();
  }

  coveragePoints() {
    if (this.coverageGrid) return this.coverageGrid;
    const r=this.world.robot,points=[];
    // 24px spacing is smaller than the 22px local dirt observation radius.
    // Candidate positions use static geometry only, never task entities.
    for(let y=0;y<this.world.height;y+=24) {
      const row=[];
      for(let x=0;x<this.world.width;x+=24) if(!this.world.checkCollision(x,y,r.radius+1)) row.push({x,y,key:`${x},${y}`});
      if((y/24)%2)row.reverse();
      points.push(...row);
    }
    this.coverageGrid=points;
    return points;
  }

  currentCoverageCell() {
    const r=this.world.robot;
    return `${Math.round(r.x/24)*24},${Math.round(r.y/24)*24}`;
  }

  observeCoverage() {
    const r=this.world.robot;
    // The physical cell is visited even when its rounded center is too close
    // to a wall to be a planning waypoint. Sensor reads never consume this visit.
    this.enteredCells.add(this.currentCoverageCell());
    for(const p of this.coveragePoints()) if(Math.hypot(p.x-r.x,p.y-r.y)<18) this.coverageVisited.add(p.key);
  }

  nextExplorationTarget() {
    if(this.explorationTarget && !this.coverageVisited.has(this.explorationTarget.key)) return this.explorationTarget;
    const r=this.world.robot;
    this.explorationTarget=this.coveragePoints().filter(p=>!this.coverageVisited.has(p.key))
      .sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y))[0] || null;
    return this.explorationTarget;
  }

  routeTo(target) {
    const r=this.world.robot;
    const direct=(from,to)=>{
      const steps=Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/2);
      for(let i=1;i<=steps;i++) if(this.world.checkCollision(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps,r.radius)) return false;
      return true;
    };
    // Planning uses only the static collision model and an already perceived goal.
    // It never searches world task entities or alters the normal door openings.
    if(direct(r,target)) {this.navigationRoute=null;return target;}
    const key=`${target.x},${target.y}`;
    if(this.navigationRoute?.key===key) {
      const points=this.navigationRoute.points;
      while(points.length>1&&Math.hypot(points[0].x-r.x,points[0].y-r.y)<3)points.shift();
      if(points[0]&&direct(r,points[0]))return points[0];
    }
    const size=8;
    if(!this.navigationGrid) {
      const grid=new Map();
      for(let x=0;x<this.world.width;x+=size)for(let y=0;y<this.world.height;y+=size)
        if(!this.world.checkCollision(x,y,r.radius+1))grid.set(`${x},${y}`,{x,y});
      this.navigationGrid=grid;
    }
    const grid=this.navigationGrid;
    const nearest=point=>[...grid.entries()].sort((a,b)=>Math.hypot(a[1].x-point.x,a[1].y-point.y)-Math.hypot(b[1].x-point.x,b[1].y-point.y)).slice(0,16).find(([,node])=>direct(point,node))?.[0];
    const start=nearest(r),goal=nearest(target);
    if(!start||!goal)return null;
    const queue=[start],parents=new Map([[start,null]]);
    for(let i=0;i<queue.length&&!parents.has(goal);i++) {
      const current=grid.get(queue[i]);
      for(const [dx,dy]of[[size,0],[-size,0],[0,size],[0,-size]]) {
        const nextKey=`${current.x+dx},${current.y+dy}`,next=grid.get(nextKey);
        if(!next||parents.has(nextKey)||!direct(current,next))continue;
        parents.set(nextKey,queue[i]);queue.push(nextKey);
      }
    }
    if(!parents.has(goal))return null;
    const points=[target];
    for(let node=goal;node!==null;node=parents.get(node))points.unshift(grid.get(node));
    this.navigationRoute={key,points};
    while(points.length>1&&Math.hypot(points[0].x-r.x,points[0].y-r.y)<3)points.shift();
    return points[0];
  }

  get lowBatteryPercent() { return this.criteria[appState.currentStage].lowBatteryPercent ?? 30; }

  updateRobotPhysics() {
    const r=this.world.robot;
    if (r.isCharging) r.battery=Math.min(100,r.battery+this.simulationSettings.chargePerTick);
    else r.battery=Math.max(0,r.battery-this.simulationSettings.batteryDrainPerTick);
    if (r.heldObject) Object.assign(r.heldObject,{x:r.x+Math.cos(r.heading)*25,y:r.y+Math.sin(r.heading)*25});
    if (this.tickCount%4===0) {r.pathTrail.push({x:r.x,y:r.y});if(r.pathTrail.length>50)r.pathTrail.shift();}
    if (appState.installedSensors.has('SENSE_02') && r.battery < this.lowBatteryPercent) this.lowBatteryEncounter=true;
    const moving = this.tickStart && Math.hypot(r.x-this.tickStart.x,r.y-this.tickStart.y)>0.001;
    if(moving) this.movingTicks++;
    if(moving && this.selectedGoal==='DOCK' && this.lowBatteryGoalSelected) this.lowBatteryTravelTicks++;
    if(!r.vacuumActive && !r.mopDeployed) this.inspectionTicks++;
    if(moving && this.humanResumePending && Math.hypot(r.x-this.world.avatar.x,r.y-this.world.avatar.y)>120 && !r.isSlow) {
      this.humanResumes++;this.humanResumePending=false;
    }
    for (const [name,entity,opportunityRadius,violationRadius] of [['cat',this.world.cat,90,40],['human',this.world.avatar,120,60]]) {
      const distance=Math.hypot(r.x-entity.x,r.y-entity.y), sensedDistance=this.tickStart?Math.hypot(this.tickStart.x-entity.x,this.tickStart.y-entity.y):distance, near=sensedDistance<=opportunityRadius;
      if(near && !this.encounters[name] && (moving || this.previousMoving)) { this[`${name}Opportunities`]++; this.encounters[name]=true; }
      // A parked robot cannot create a new encounter from movement long ago.
      if(!near)this.encounters[name]=false;
      if(!near) { this.encounters[`${name}Violation`]=false; this.encounters[`${name}Response`]=false; }
      if(this.encounters[name] && (name==='cat'?r.isStopped:r.isSlow) && !this.encounters[`${name}Response`]) {
        this[`${name}Responses`]++; if(name==='human')this.humanResumePending=true; this.encounters[`${name}Response`]=true;
      }
      if(name==='human' && near && moving)this.humanNearSpeeds.push(r.isSlow?1:r.speed);
      if((name==='cat'?distance<violationRadius:sensedDistance<=opportunityRadius) && moving && (name==='cat'||!r.isSlow) && !this.encounters[`${name}Violation`]) {
        this[`${name==='cat'?'cat':'human'}SafetyViolations`]++;
        this.encounters[`${name}Violation`]=true;
      }
    }
    this.previousMoving=Boolean(moving);
    const wet=this.world.wetCells.filter(w=>!w.cleaned&&Math.hypot(r.x-w.x,r.y-w.y)<w.radius+10);
    if(r.vacuumActive && appState.installedActuators.has('ACTUATOR_VACUUM')) {
      this.vacuumTicks++;
      if(!wet.length && !this.world.dirtCells.some(d=>!d.cleaned&&Math.hypot(r.x-d.x,r.y-d.y)<d.radius+15))this.cleanVacuumTicks++;
      for(const w of wet) if(!this.encounters.wet.includes(w.id)) this.vacuumLiquidMistakes++;
      this.encounters.wet=wet.map(w=>w.id);
      if(!wet.length) for(const d of this.world.dirtCells) if(Math.hypot(r.x-d.x,r.y-d.y)<d.radius+15)d.cleaned=true;
    } else this.encounters.wet=[];
    if(r.mopDeployed && appState.installedActuators.has('ACTUATOR_MOP')) {
      this.mopTicks++; for(const w of wet) w.cleaned=true;
    }
    if(Math.hypot(r.x-this.world.dock.x,r.y-this.world.dock.y)<30)this.reachedDock=true;
  }

  updateOutcomes(final=false) {
    this.finalOutcomes=final;
    const dirt=this.world.dirtCells,objects=this.world.objects,wet=this.world.wetCells;
    const cleaned=dirt.filter(d=>d.cleaned).length,sorted=objects.filter(o=>o.sorted).length,mopped=wet.filter(w=>w.cleaned).length;
    const done=[dirt.length>0&&cleaned===dirt.length,objects.length>0&&sorted===objects.length,wet.length>0&&mopped===wet.length,
      this.catOpportunities>0&&this.catResponses>=this.catOpportunities&&this.movingTicks>0&&this.catSafetyViolations===0,this.humanOpportunities>0&&this.humanResponses>=this.humanOpportunities&&this.movingTicks>0&&this.humanSafetyViolations===0,this.dockedAtBattery!==null];
    this.updateCriteria();
    // Functional criterion settings govern task completion; Speed stays separate.
    for (const { taskId, status } of this.criteriaResults) {
      if (taskId) done[Number(taskId.slice(5)) - 1] = status === 'Achieved';
    }
    const started=[this.vacuumTicks>0,this.pickups>0,this.mopTicks>0,this.catOpportunities>0,this.humanOpportunities>0,this.dockRequested||this.reachedDock];
    const failed=[false,this.wrongReleases>0,false,this.catSafetyViolations>0,this.humanSafetyViolations>0,this.world.robot.battery<=0&&!done[5]];
    const summaries=[this.vacuumLiquidMistakes?`Vacuumed on a spill ${this.vacuumLiquidMistakes} times.`:!this.vacuumTicks?'Never vacuumed.':!cleaned?'Vacuum ran but nothing was cleaned.':`Cleaned ${cleaned} of ${dirt.length} dirty cells.`,
      this.wrongReleases?`Released ${this.wrongReleases} objects in the wrong place.`:!this.pickups?'Never grabbed anything.':!sorted?`Picked up ${this.pickups}, released none at a destination.`:`Sorted ${sorted} of ${objects.length} objects.`,
      !this.mopTicks?'Never mopped.':!mopped?'Mop ran but nothing was cleaned.':`Mopped ${mopped} of ${wet.length} spills.`,
      this.catSafetyViolations?`Kept moving with the cat within reach ${this.catSafetyViolations} times.`:done[3]?'Stopped for the cat every time.':this.catOpportunities?'Moved near the cat without stopping.':'No moving encounter with the cat.',
      this.humanSafetyViolations?`Passed the person at full speed ${this.humanSafetyViolations} times.`:done[4]?'Slowed down for the person every time.':this.humanOpportunities?'Moved near the person without slowing.':'No moving encounter with the person.',
      done[5]?`Docked at ${Math.round(this.dockedAtBattery)}% battery.`:failed[5]?'Battery ran out before docking.':this.reachedDock?'Reached the dock but never connected.':'Never approached the dock.'];
    this.taskOutcomes=done.map((success,i)=>({taskId:`TASK_${i+1}`,status:success?'done':failed[i]||final?'failed':started[i]?'in_progress':'not_started',summary:summaries[i]})).filter(outcome => appState.selectedTasks.includes(outcome.taskId));
    const allDone=this.criteriaResults.every(c=>c.status==='Achieved');
    if(!allDone) this.completionSeconds=null;
    else if(this.runActive && this.completionSeconds===null)this.completionSeconds=this.elapsedSeconds;
  }

  updateCriteria() {
    const config = this.criteria[appState.currentStage];
    const counts = {
      cleaning: [this.world.dirtCells.filter(d=>d.cleaned).length,this.world.dirtCells.length,config.dirtFraction,'dirt cells cleaned'],
      sorting: [this.world.objects.filter(o=>o.sorted).length,this.world.objects.length,config.sortedFraction,'objects correctly sorted'],
      spills: [this.world.wetCells.filter(w=>w.cleaned).length,this.world.wetCells.length,config.spillFraction,'spills mopped']
    };
    const results=criterionDescriptions(appState.currentStage,this.criteria).filter(c=>c.id!=='speed').map(criterion=>{
      let achieved=false,partial=false,observed;
      if(counts[criterion.id]) {
        const [count,total,fraction,label]=counts[criterion.id];
        achieved=total>0&&count/total>=fraction;partial=count>0;observed=`${count} / ${total} ${label}`;
        if(criterion.id==='spills') {achieved &&= this.vacuumLiquidMistakes<=config.maxVacuumLiquidMistakes;observed+=`; ${this.vacuumLiquidMistakes} vacuum-on-liquid events`;}
      } else if(criterion.id==='cat') {
        achieved=this.catOpportunities>=config.minCatEncounters && this.catResponses>=this.catOpportunities && this.movingTicks>0 && this.catSafetyViolations<=config.maxCatViolations;
        partial=this.catResponses>0;observed=`${this.catOpportunities} moving encounters; ${this.catResponses} stops; ${this.catSafetyViolations} unsafe crossings`;
      } else if(criterion.id==='human') {
        achieved=this.humanOpportunities>=config.minHumanEncounters && this.humanResponses>=this.humanOpportunities && this.humanResumes>=config.minHumanResumes && this.movingTicks>0 && this.humanSafetyViolations<=config.maxHumanViolations;
        partial=this.humanResponses>0;observed=`${this.humanOpportunities} moving encounters; ${this.humanResponses} slow responses; ${this.humanResumes} resumes; ${this.humanSafetyViolations} fast passes`;
      } else if(criterion.id==='docking') {
        achieved=this.lowBatteryEncounter && this.lowBatteryGoalSelected && this.lowBatteryTravelTicks>0 && this.dockedAtBattery>0;
        partial=this.lowBatteryGoalSelected;observed=this.dockedAtBattery===null?`Low battery ${this.lowBatteryEncounter?'observed':'not observed'}; ${this.lowBatteryTravelTicks} travel ticks toward selected DOCK; not connected`:`Connected at ${this.dockedAtBattery.toFixed(1)}% battery; ${this.lowBatteryTravelTicks} low-battery travel ticks`;
      }
      return {...criterion,observed,status:achieved?'Achieved':partial?'Partially achieved':'Not achieved'};
    });
    const functionalDone=results.every(c=>c.status==='Achieved');
    if(!functionalDone)this.functionalCompletionSeconds=null;
    else if(this.runActive && this.functionalCompletionSeconds===null)this.functionalCompletionSeconds=this.elapsedSeconds;
    this.criteriaResults=results;
    const speed=criterionDescriptions(appState.currentStage,this.criteria).find(c=>c.id==='speed');
    if(speed){const duration=this.functionalCompletionSeconds??this.elapsedSeconds;this.criteriaResults.push({...speed,observed:`${duration.toFixed(1)} seconds${functionalDone?' to complete tasks':' elapsed; tasks incomplete'}`,status:functionalDone&&duration<=config.speedLimitSeconds?'Achieved':'Not achieved'});}
  }

  computeScores() {
    const ratio=(cells,predicate)=>cells.length?cells.filter(predicate).length/cells.length:0;
    this.scores.coverage=Math.round(100*(ratio(this.world.dirtCells,d=>d.cleaned)*SCORE_CONSTANTS.dirtShare+ratio(this.world.objects,o=>o.sorted)*SCORE_CONSTANTS.objectShare));
    this.scores.safety=Math.max(0,100-this.catSafetyViolations*SCORE_CONSTANTS.catPenalty-this.humanSafetyViolations*SCORE_CONSTANTS.humanPenalty);
    this.scores.hazard=Math.max(0,Math.round(ratio(this.world.wetCells,w=>w.cleaned)*100-this.vacuumLiquidMistakes*SCORE_CONSTANTS.liquidPenalty));
    const time=this.completionSeconds??this.elapsedSeconds;
    this.scores.time=Math.max(0,Math.round(100-Math.max(0,time-this.runLimitSeconds)/this.runLimitSeconds*100));
    const w=appState.weights;
    this.scores.composite=Math.round((this.scores.coverage*w.Coverage+this.scores.safety*w.Safety+this.scores.time*w.Time+this.scores.hazard*w.Hazard)/100);
  }
}
