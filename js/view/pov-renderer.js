/** PEASLab2D - Robot first-person camera and return navigation. */
import { appState } from '../state.js';
import { SENSORS_CATALOG } from '../data/sensors.js';

export function getMountedChannels(installed, percepts = {}) {
  return SENSORS_CATALOG.filter(sensor => installed.has(sensor.id)).map(sensor => ({
    id: sensor.id, name: sensor.shortName, value: ['NOT_INSTALLED','NOT_MODELLED'].includes(percepts[sensor.id]) ? '—' : (percepts[sensor.id] ?? '—')
  }));
}

export function getRobotCameraPose(robot, project) {
  return {
    position: project(robot.x, robot.y, 0.45),
    target: project(robot.x + Math.cos(robot.heading) * 60,
      robot.y + Math.sin(robot.heading) * 60, 0.45)
  };
}

export class RobotPovRenderer {
  constructor(containerElement, world, options = {}) {
    this.container = containerElement;
    this.world = world;
    this.options = options;
    this.previous = null;
  }

  enter() {
    if (this.previous || !this.options.map3d) return false;
    this.previous = {
      page: this.options.capturePage(),
      camera: this.options.map3d.captureViewState()
    };
    appState.setRobotPov?.(true, this.previous.page.mode);
    appState.isRobotPovActive = true;
    this.options.showCamera();
    this.container.innerHTML = `
      <div class="robot-pov-toolbar">
        <div><strong>🤖 Robot POV</strong><span>Esc to exit</span></div>
        <button class="btn btn-primary close-pov-btn">Exit Robot POV</button>
      </div>
      <div class="robot-sensor-backdrop" style="position:absolute;inset:64px 0 0;background:#07111f;pointer-events:none"></div>
      <div class="robot-sensor-channels" style="position:absolute;left:16px;top:80px;padding:12px;background:rgba(7,17,31,.92);color:white;pointer-events:none"></div>`;
    this.container.style.display = 'block';
    this.container.querySelector('.close-pov-btn').addEventListener('click', () => this.exit());
    this.updateChannels();
    if (typeof window !== 'undefined') this.channelTimer = window.setInterval(() => this.updateChannels(), 150);
    return true;
  }

  updateChannels() {
    const channels = getMountedChannels(appState.installedSensors, this.options.getPercepts?.() ?? this.options.engine?.currentPercepts ?? this.options.engine?.readSensors?.() ?? {});
    const backdrop = this.container.querySelector('.robot-sensor-backdrop');
    if (backdrop?.style) backdrop.style.display = appState.installedSensors.has('SENSE_15') ? 'none' : 'block';
    const panel = this.container.querySelector('.robot-sensor-channels');
    if (!panel || !('textContent' in panel)) return;
    panel.textContent = channels.map(channel => `${channel.name}: ${typeof channel.value === 'object' ? JSON.stringify(channel.value) : channel.value}`).join('\n');
    panel.style.whiteSpace = 'pre-line';
  }

  exit() {
    if (!this.previous) return false;
    const previous = this.previous;
    this.previous = null;
    if (this.channelTimer) window.clearInterval(this.channelTimer);
    appState.setRobotPov?.(false, previous.page.mode);
    appState.isRobotPovActive = false;
    this.container.style.display = 'none';
    this.options.restorePage(previous.page);
    this.options.map3d.restoreViewState(previous.camera);
    return true;
  }
}
