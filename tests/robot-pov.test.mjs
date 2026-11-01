import test from 'node:test';
import assert from 'node:assert/strict';
import * as pov from '../js/view/pov-renderer.js';
import { appState } from '../js/state.js';
import { HouseCanvasRenderer } from '../js/view/house-canvas.js';

test('map shortcuts cannot move the player or open a workstation during robot POV', t => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const listeners = {};
  let opened = 0;
  globalThis.window = {
    currentViewMode: 'robot',
    addEventListener: (name, callback) => { listeners[name] = callback; },
    openStepModal: () => { opened++; }
  };
  globalThis.document = { getElementById: () => null };
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
  const renderer = Object.create(HouseCanvasRenderer.prototype);
  renderer.canvas = { addEventListener() {} };
  renderer.activeStationPrompt = { step: 2 };
  renderer.keys = { w: false };
  renderer.headingAngle = 0;
  renderer.initControls();
  for (const key of ['w', 'q', ' ']) {
    listeners.keydown({ key, target: { tagName: 'BODY' }, preventDefault() {} });
  }
  assert.equal(opened, 0);
  assert.equal(renderer.keys.w, false);
  assert.equal(renderer.headingAngle, 0);
});

test('robot camera follows position and heading rather than the player avatar', () => {
  assert.equal(typeof pov.getRobotCameraPose, 'function');
  const project = (x, y, height) => ({ x: x / 60, y: height, z: y / 60 });
  const robot = { x: 60, y: 120, heading: 0 };
  let pose = pov.getRobotCameraPose(robot, project);
  assert.deepEqual(pose.position, { x: 1, y: 0.45, z: 2 });
  assert.deepEqual(pose.target, { x: 2, y: 0.45, z: 2 });
  robot.x = 180;
  robot.heading = Math.PI / 2;
  pose = pov.getRobotCameraPose(robot, project);
  assert.equal(pose.position.x, 3);
  assert.ok(Math.abs(pose.target.x - 3) < 1e-10);
  assert.equal(pose.target.z, 3);
});

for (const mode of ['2d', '3d', 'fps']) {
  test(`exiting robot POV restores the original ${mode} page and camera`, () => {
    appState.isRobotPovActive = false;
    let page = { mode, step: 2, modalOpen: true, scrollTop: 140 };
    let camera = { position: [4, 14, 18], viewMode: mode };
    const originalPage = structuredClone(page);
    const originalCamera = structuredClone(camera);
    const exitButton = { addEventListener(type, callback) { this.click = callback; } };
    const container = { style: { display: 'none' }, innerHTML: '', querySelector: () => exitButton };
    const map3d = {
      captureViewState: () => structuredClone(camera),
      restoreViewState: saved => { camera = saved; }
    };
    const view = new pov.RobotPovRenderer(container, {}, {
      map3d,
      capturePage: () => structuredClone(page),
      showCamera: () => { page = { mode: 'robot', modalOpen: false }; camera = { viewMode: 'robot' }; },
      restorePage: saved => { page = saved; }
    });
    assert.equal(typeof view.enter, 'function');
    assert.equal(view.enter(), true);
    assert.equal(appState.isRobotPovActive, true);
    assert.equal(page.mode, 'robot');
    assert.equal(container.style.display, 'block');
    assert.equal(view.enter(), false, 'Repeated entry must not overwrite the return location');
    exitButton.click();
    assert.equal(appState.isRobotPovActive, false);
    assert.deepEqual(page, originalPage);
    assert.deepEqual(camera, originalCamera);
    assert.equal(container.style.display, 'none');
    assert.equal(view.exit(), false);
  });
}
