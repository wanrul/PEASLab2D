/**
 * PEASLab2D - Single-Learner State Manager
 * Handles one learner’s PEAS configurations, rules, observations and debug activity.
 */

import { DEFAULT_RULE_TEMPLATES, ALL_BLOCKS } from './data/blocks.js';

class StateManager {
  constructor() {
    this.eventOrder = 0;
    this.currentStep = 1; // 1: Purpose/P, 2: World/E+S, 3: Body/A, 4: Logic/Code, 5: Test/Debug
    this.participantId = 'Learner';

    // Step 1: Purpose & Performance Measures
    this.agentPurpose = 'Autonomous Household Cleaning & Hazard-Avoidance Assistant';
    this.selectedTasks = ['TASK_1', 'TASK_2', 'TASK_3', 'TASK_4', 'TASK_5', 'TASK_6'];
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

    // Step 4: Decision rules grouped in six fixed task zones.
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
    this.notify('sessionEvent', { event, target, detail: typeof detail === 'object' && detail !== null ? {...detail,order:++this.eventOrder} : {value:detail,order:++this.eventOrder}, step });
  }

  canContinue(step = this.currentStep) {
    if (step === 1) return Object.values(this.weights).reduce((a, b) => a + b, 0) === 100;
    if (step === 2) return this.installedSensors.size >= 8 && this.installedSensors.size <= 11;
    if (step === 3) return this.installedActuators.size >= 7 && this.installedActuators.size <= 10;
    if (step === 4) return this.rules.some(rule => rule.slots.sense && rule.slots.action);
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
    if (oldStep === 1) this.record('WEIGHT_SET', 'weights', { ...this.weights, durationMs });
    if (step < oldStep) {
      this.revisitedSteps.push(step);
      this.debugIterations++;
      this.record('STEP_REVISITED', String(step), { from: oldStep, durationMs });
    }
    this.unlockedStep = Math.max(this.unlockedStep, step);
    this.currentStep = step;
    this.stepEnteredAt = Date.now();
    this.notify('stepChanged', { step, oldStep, durationMs });
    return true;
  }

  recordHotspot(id, view = '2d') { this.record('HOTSPOT_VIEWED', id, { view }); }

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
      if (this.installedSensors.size >= 11) {
        return { success: false, reason: 'Robot chassis is at maximum capacity (11 sensors).' };
      }
      this.installedSensors.add(sensorId);
    }
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
    this.record(isInstalled ? 'ACTUATOR_REMOVED' : 'ACTUATOR_MOUNTED', actuatorId, { order: this.installedActuators.size, installed: [...this.installedActuators] });
    this.notify('actuatorsChanged', { installed: Array.from(this.installedActuators) });
    return { success: true };
  }

  createRule(task) {
    return { taskId: task.taskId, taskName: task.taskName, id: `RULE_${this.nextRuleId++}`,
      slots: { sense: null, condition: null, action: null, control: null, secondaryAction: null } };
  }

  getAttemptedTaskIds() {
    return [...new Set(this.rules.filter(rule => rule.slots.sense && rule.slots.action).map(rule => rule.taskId))];
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
    const kinds = { sense: 'Sense', condition: 'Condition', action: 'Action', secondaryAction: 'Action', control: 'Control' };
    if (!rule || !kinds[slotName]) return false;
    if (blockId && !ALL_BLOCKS.some(block => block.id === blockId && block.kind === kinds[slotName])) return false;
    const previous = rule.slots[slotName];
    if (previous === blockId) return true;
    const detail = { zone: DEFAULT_RULE_TEMPLATES.findIndex(task => task.taskId === rule.taskId), taskId: rule.taskId, ruleId: rule.id, slot: slotName };
    if (previous) this.record('BLOCK_REMOVED', previous, detail);
    rule.slots[slotName] = blockId || null;
    if (blockId) this.record('BLOCK_PLACED', blockId, detail);
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
