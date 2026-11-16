import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three/three.module.js';
import {Apartment3DMap} from '../js/view/map-3d.js';
function map(mode){const m=Object.create(Apartment3DMap.prototype);m.viewMode=mode;m.camera=new THREE.PerspectiveCamera(48,1.6,.1,100);m.canvas={clientHeight:900};m.avatarGroup={visible:true};return m;}
test('FPS widens field of view and hides the player body',()=>{const m=map('fps');m.updateViewPresentation();assert.equal(m.camera.fov,78);assert.equal(m.avatarGroup.visible,false);});
test('returning to orbit restores normal perspective and player body',()=>{const m=map('orbit');m.updateViewPresentation();assert.equal(m.camera.fov,48);assert.equal(m.avatarGroup.visible,true);});
test('robot POV uses the wider perspective while keeping the other person visible',()=>{const m=map('robot');m.updateViewPresentation();assert.equal(m.camera.fov,78);assert.equal(m.avatarGroup.visible,true);});
