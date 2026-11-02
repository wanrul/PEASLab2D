/**
 * PEASLab2D - Single-Learner State Manager
 * Handles one learner’s PEAS configurations, rules, observations and debug activity.
 */

import { DEFAULT_RULE_TEMPLATES, ALL_BLOCKS } from './data/blocks.js';
import { validateProgram } from './sim/program.js';
import { PILOT_STAGES, TASK_PURPOSES } from './pilot-config.js';

class StateManager {
  constructor() {
    this.eventOrder = 0;
    this.currentStep = 1; // 1: Purpose/P, 2: World/E+S, 3: Body/A, 4: Logic/Code, 5: Test/Debug
    this.participantId = 'Learner';

    // Step 1: Purpose & Performance Measures
    this.agentPurpose = 'Design a household robot, one stage at a time.';
    this.currentStage = 1;
    this.selectedTasks = [...PILOT_STAGES[0].taskIds];
    this.stagePurposes = { 1: this.createStagePurposes(1) };
    this.stageResults = { 1: { passingRunId: null, closingText: '' } };
    this.unlockedStep = 1;
    this.stepEnteredAt = Date.now();
    this.timeInStep = {};
    this.revisitedSteps = [];
    this.runHistory = [];
    this.closingText = '';
    this.reflectionPrompt = null;
    this.weights = {
      Coverage: 40,
      Safety: 20,
      Time: 20,
      Hazard: 20
    };

    // Step 2: Sensors
    this.installedSensors = new Set();
    this.isRobotPovActive = false;

    // Step 3: Actuators
    this.installedActuators = new Set();

    // Step 4: Structured programs; legacy rules retain compatible primitive APIs.
    this.program = [];
    this.blockWorkspace = null;
    this.nextRuleId = 1;
    this.rulesRevision = 0;
    this.rules = DEFAULT_RULE_TEMPLATES.map(task => this.createRule(task));

    // Step 5: Simulation & Observation
    this.simRunning = false;
    this.simTick = 0;
    this.simSpeed = 1; // 1x, 2x, 5x
    this.observationLogs = []; // { id, timestamp, tick, participantId, stamp: '✓'|'✗'|'?', comment }

    // Debugging tracking (Design Flow 5.3)
    this.debugIterations = 1;
    this.debugMoves = {
      move1_swap: 0,
      move2_addRule: 0,
      move3_returnStep: 0
    };

    // Observers
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error in listener for ${event}:`, e); }
      });
    }
  }

  record(event, target = '', detail = {}, step = this.currentStep) {
    this.notify('sessionEvent', { event, target, detail: typeof detail === 'object' && detail !== null ? {stageId:this.currentStage,taskIds:[...this.selectedTasks],...detail,order:++this.eventOrder} : {stageId:this.currentStage,taskIds:[...this.selectedTasks],value:detail,order:++this.eventOrder}, step });
  }

  canContinue(step = this.currentStep) {
    if (step === 1) return PILOT_STAGES[this.currentStage-1].missionTaskIds.every(id => Boolean(this.stagePurposes[this.currentStage]?.[id]?.priority));
    if (step === 2) return this.installedSensors.size <= this.sensorBudget;
    if (step === 3) return this.installedActuators.size <= 10;
    if (step === 4 && this.blockWorkspace !== null) return this.program.some(b=>this.selectedTasks.includes(b.taskId));
    if (step === 4 && this.program.length) return true;
    if (step === 4) return this.getUnlockedRules().some(rule => rule.slots.sense && rule.slots.action);
    return step === 5;
  }

  canEnterStep(step) {
    return Number.isInteger(step) && step >= 1 && step <= 5 &&
      (step <= this.unlockedStep || (step === this.currentStep + 1 && this.canContinue()));
  }

  setStep(step) {
    if (!this.canEnterStep(step)) return false;
    const oldStep = this.currentStep;
    if (step === oldStep) return true;
    const durationMs = Date.now() - this.stepEnteredAt;
    this.timeInStep[oldStep] = (this.timeInStep[oldStep] || 0) + durationMs;
    this.record('STEP_TIME', String(oldStep), { durationMs });
    if (step < oldStep) {
      this.revisitedSteps.push(step);
      this.debugIterations++;
      this.record('STEP_REVISITED', String(step), { from: oldStep, durationMs });
    }
    this.unlockedStep = Math.max(this.unlockedStep, step);
    this.currentStep = step;
    this.stepEnteredAt = Date.now();
    this.record('STEP_ENTERED', String(step), { from: oldStep, to: step });
    this.notify('stepChanged', { step, oldStep, durationMs });
    return true;
  }

  createStagePurposes(stageId) {
    return Object.fromEntries(PILOT_STAGES[stageId - 1].missionTaskIds.map(id => [id, { purpose: TASK_PURPOSES[id].purpose, priority: null }]));
  }

  setTaskPurpose(taskId, purpose) {
    const task = this.stagePurposes[this.currentStage]?.[taskId];
    if (!task || !this.selectedTasks.includes(taskId)) return false;
    task.purpose = String(purpose);
    this.rulesRevision++;
    this.record('PURPOSE_CHANGED', taskId, { taskId, purpose: task.purpose });
    this.notify('purposeChanged', { taskId });
    return true;
  }

  setTaskPriority(taskId, priority) {
    const task = this.stagePurposes[this.currentStage]?.[taskId];
    if (!task || !this.selectedTasks.includes(taskId) || !TASK_PURPOSES[taskId].priorities.some(([id]) => id === priority)) return false;
    task.priority = priority;
    this.rulesRevision++;
    this.record('TASK_PRIORITY_CHANGED', taskId, { taskId, priority });
    this.notify('purposeChanged', { taskId });
    return true;
  }

  setProgram(program, workspace = this.blockWorkspace) {
    if (!validateProgram(program)) return false;
    let savedProgram, savedWorkspace;
    try {
      JSON.stringify(program); // Catch cycles even in non-executable metadata before changing state.
      savedProgram=structuredClone(program);
      savedWorkspace=structuredClone(workspace);
    } catch { return false; }
    this.program = savedProgram;
    this.blockWorkspace = savedWorkspace;
    this.rulesRevision++;
    this.record('PROGRAM_CHANGED', 'program', { program: this.program, workspace: this.blockWorkspace });
    this.notify('programChanged', { program: this.program });
    return true;
  }

  getUnlockedRules() { return this.rules.filter(rule => this.selectedTasks.includes(rule.taskId)); }

  get sensorBudget() { return PILOT_STAGES[this.currentStage - 1].sensorBudget; }

  getConfiguration() {
    return { stageId: this.currentStage, sensorBudget: this.sensorBudget, taskIds: [...this.selectedTasks], purposes: structuredClone(this.stagePurposes[this.currentStage]),
      program: structuredClone(this.program), workspace: structuredClone(this.blockWorkspace),
      sensors: [...this.installedSensors], actuators: [...this.installedActuators], rules: structuredClone(this.getUnlockedRules()) };
  }

  retainRun(snapshot) {
    this.runHistory.push(snapshot);
    if (snapshot.passed) this.stageResults[snapshot.stageId].passingRunId = snapshot.runId;
  }

  canContinueStage() { return this.currentStage < PILOT_STAGES.length && this.stageResults[this.currentStage].passingRunId !== null; }

  continueStage() {
    if (!this.canContinueStage()) return false;
    const from = this.currentStage, to = from + 1;
    this.record('STAGE_ENDED', String(from), { passingRunId: this.stageResults[from].passingRunId });
    this.record('STAGE_TRANSITION', String(to), { from, to });
    this.currentStage = to;
    this.selectedTasks = [...PILOT_STAGES[to - 1].taskIds];
    this.stagePurposes[to] = { ...this.createStagePurposes(to), ...structuredClone(this.stagePurposes[from]) };
    this.stageResults[to] = { passingRunId: null, closingText: '' };
    this.currentStep = this.unlockedStep = 1;
    this.stepEnteredAt = Date.now();
    this.rulesRevision++;
    this.reflectionPrompt = null;
    this.record('STAGE_STARTED', String(to));
    this.notify('stageChanged', { from, stageId: to });
    return true;
  }

  recordHotspot(id, view = 'fallback') { this.record('HOTSPOT_VIEWED', id, { view }); }

  setRobotPov(active, view = '2d') {
    if (active === this.isRobotPovActive) return;
    this.isRobotPovActive = active;
    if (active) this.povEnteredAt = Date.now();
    this.record(active ? 'POV_ENTERED' : 'POV_EXITED', view,
      { view, durationMs: active ? 0 : Date.now() - this.povEnteredAt });
    this.notify('povChanged', { active, view });
  }

  selectReflection(option) {
    if (!this.reflectionPrompt) return;
    this.record('REFLECTION_SELECTED', option, { latencyMs: Date.now() - this.reflectionPrompt.shownAt, runId: this.reflectionPrompt.runId });
    this.reflectionPrompt = null;
    this.notify('reflectionSelected', { option });
  }

  setClosingText(text) {
    this.closingText = text;
    this.stageResults[this.currentStage].closingText = text;
    this.record('CLOSING_TEXT', 'closing', { text });
  }

  setWeight(dimension, value) {
    if (this.weights[dimension] !== undefined) {
      this.weights[dimension] = Math.max(0, Math.min(100, Math.round(Number(value) / 10) * 10));
      this.record('WEIGHT_SET', dimension, { value: this.weights[dimension], weights: { ...this.weights } });
      this.notify('weightsChanged', { weights: { ...this.weights } });
    }
  }

  toggleSensor(sensorId) {
    const isInstalled = this.installedSensors.has(sensorId);
    if (isInstalled) {
      this.installedSensors.delete(sensorId);
    } else {
      if (this.installedSensors.size >= this.sensorBudget) {
        this.record('SENSOR_REJECTED', sensorId, { budget: this.sensorBudget, installed: [...this.installedSensors] });
        return { success: false, reason: `Stage ${this.currentStage} allows up to ${this.sensorBudget} sensors. Remove or replace a mounted sensor.` };
      }
      this.installedSensors.add(sensorId);
    }
    this.rulesRevision++;
    this.record(isInstalled ? 'SENSOR_REMOVED' : 'SENSOR_MOUNTED', sensorId, { order: this.installedSensors.size, installed: [...this.installedSensors] });
    this.notify('sensorsChanged', { installed: Array.from(this.installedSensors) });
    return { success: true };
  }

  toggleActuator(actuatorId) {
    const isInstalled = this.installedActuators.has(actuatorId);
    if (isInstalled) {
      this.installedActuators.delete(actuatorId);
    } else {
      if (this.installedActuators.size >= 10) return { success: false };
      this.installedActuators.add(actuatorId);
    }
    this.rulesRevision++;
    this.record(isInstalled ? 'ACTUATOR_REMOVED' : 'ACTUATOR_MOUNTED', actuatorId, { order: this.installedActuators.size, installed: [...this.installedActuators] });
    this.notify('actuatorsChanged', { installed: Array.from(this.installedActuators) });
    return { success: true };
  }

  createRule(task) {
    return { taskId: task.taskId, taskName: task.taskName, id: `RULE_${this.nextRuleId++}`,
      slots: { sense: null, condition: null, action: null, control: null, secondaryAction: null, priority: null } };
  }

  getAttemptedTaskIds() {
    if(this.program.length)return [...new Set(this.program.filter(b=>this.selectedTasks.includes(b.taskId)).map(b=>b.taskId))];
    return [...new Set(this.getUnlockedRules().filter(rule => rule.slots.sense && rule.slots.action).map(rule => rule.taskId))];
  }

  addRule(taskId) {
    const task = DEFAULT_RULE_TEMPLATES.find(task => task.taskId === taskId);
    if (!task) return false;
    const rule = this.createRule(task);
    const last = this.rules.findLastIndex(row => row.taskId === taskId);
    this.rules.splice(last + 1, 0, rule);
    this.record('RULE_ADDED', rule.id, { taskId, slots: { ...rule.slots } });
    this.rulesRevision++;
    this.notify('rulesChanged', { rules: this.rules });
    return rule;
  }

  removeRule(ruleId) {
    const index = this.rules.findIndex(rule => rule.id === ruleId), rule = this.rules[index];
    if (!rule || this.rules.filter(row => row.taskId === rule.taskId).length === 1) return false;
    this.rules.splice(index, 1);
    this.record('RULE_REMOVED', rule.id, { taskId: rule.taskId, slots: { ...rule.slots } });
    this.rulesRevision++;
    this.notify('rulesChanged', { rules: this.rules });
    return true;
  }

  setRuleSlot(ruleRef, slotName, blockId) {
    const rule = typeof ruleRef === 'number' ? this.rules[ruleRef] : this.rules.find(rule => rule.id === ruleRef);
    const kinds = { sense: 'Sense', condition: 'Condition', action: 'Action', secondaryAction: 'Action', control: 'Control', priority: 'Control' };
    if (!rule || !kinds[slotName]) return false;
    if (blockId && !ALL_BLOCKS.some(block => block.id === blockId && block.kind === kinds[slotName])) return false;
    if (blockId && slotName === 'control' && ['CTRL_05','CTRL_06'].includes(blockId)) return false;
    if (blockId && slotName === 'priority' && !['CTRL_05','CTRL_06'].includes(blockId)) return false;
    const previous = rule.slots[slotName];
    if (previous === blockId) return true;
    const detail = { zone: DEFAULT_RULE_TEMPLATES.findIndex(task => task.taskId === rule.taskId), taskId: rule.taskId, ruleId: rule.id, slot: slotName };
    if (previous) this.record('BLOCK_REMOVED', previous, detail);
    rule.slots[slotName] = blockId || null;
    if (blockId) this.record('BLOCK_PLACED', blockId, detail);
    if (slotName === 'priority') this.record('RULE_PRIORITY_CHANGED', rule.id, { taskId: rule.taskId, ruleId: rule.id, priority: blockId || null });
    this.rulesRevision++;
    this.notify('rulesChanged', { rules: this.rules });
    return true;
  }

  clearRuleSlot(ruleRef, slotName) { return this.setRuleSlot(ruleRef, slotName, null); }

  addObservationStamp(stamp, comment = '') {
    const entry = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString(),
      tick: this.simTick,
      participantId: this.participantId,
      stageId: this.currentStage, taskIds: [...this.selectedTasks],
      stamp, // '✓' (Expected), '✗' (Mismatch), '?' (Uncertain)
      comment
    };
    this.observationLogs.push(entry);
    this.record('STAMP', stamp, { comment, tick: this.simTick });
    this.notify('observationAdded', entry);
    return entry;
  }

  addObservation(stamp, comment = '') {
    return this.addObservationStamp(stamp, comment);
  }

  recordDebugMove(moveType) {
    if (moveType === 'move1_swap') this.debugMoves.move1_swap++;
    if (moveType === 'move2_addRule') this.debugMoves.move2_addRule++;
    if (moveType === 'move3_returnStep') this.debugMoves.move3_returnStep++;
    this.debugIterations++;
    this.notify('debugMoveRecorded', { moveType, moves: this.debugMoves });
  }

  getDominantDimension() {
    let dominant = 'Coverage';
    let max = -1;
    for (const [dim, val] of Object.entries(this.weights)) {
      if (val > max) {
        max = val;
        dominant = dim;
      }
    }
    return dominant;
  }
}

export const appState = new StateManager();
