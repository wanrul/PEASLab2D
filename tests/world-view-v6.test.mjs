import test from 'node:test';
import assert from 'node:assert/strict';
import { getMountedChannels } from '../js/view/pov-renderer.js';
import { Apartment3DMap } from '../js/view/map-3d.js';
import * as THREE from '../lib/three/three.module.js';

test('POV channels contain only mounted sensors and never leak auxiliary ground truth', () => {
  const channels = getMountedChannels(new Set(['SENSE_02', 'SENSE_06']), {
    SENSE_02: 'LOW', SENSE_06: 'DRY', SENSE_01: 'DETECTED', catDistancePx: 20
  });
  assert.deepEqual(channels.map(channel => [channel.id, channel.value]), [['SENSE_02', 'LOW'], ['SENSE_06', 'DRY']]);
  assert.deepEqual(getMountedChannels(new Set(), { SENSE_15: 'TRASH' }), []);
});

test('FPS right movement follows camera screen right at every cardinal yaw', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const map = Object.create(Apartment3DMap.prototype);
    map.fpsYaw = yaw;
    map.fpsPitch = 0;
    map.keys = { d: true };
    let move;
    map.world = {
      avatar: { x: 500, y: 500, speed: 2, radius: 12 },
      resolveMove(x, y, dx, dy) { move = { dx, dy }; return { moved: true, x: x + dx, y: y + dy }; }
    };
    map.to3D = (x, y, height) => new THREE.Vector3(x, height, y);
    map.camera = new THREE.PerspectiveCamera();
    map.updateFpsLocomotion(1 / 60);
    assert.ok(move.dx * -Math.cos(yaw) + move.dy * Math.sin(yaw) > 0);
    assert.equal(map.world.avatar.heading, Math.atan2(move.dy, move.dx));
  }
});
