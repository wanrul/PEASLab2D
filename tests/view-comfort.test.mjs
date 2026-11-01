import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three/three.module.js';
import {Apartment3DMap} from '../js/view/map-3d.js';
function map(mode){const m=Object.create(Apartment3DMap.prototype);m.viewMode=mode;m.camera=new THREE.PerspectiveCamera(48,1.6,.1,100);m.canvas={clientHeight:900};m.avatarGroup={visible:true};m.robotActionSprite=new THREE.Sprite();m.robotActionSprite.position.set(0,0,-1);const sprite=new THREE.Sprite();sprite.position.set(0,0,-1);m.stationObjects=[{sprite,colMesh:{visible:true}}];return m;}
test('FPS widens field of view, hides own body and suppresses hologram columns',()=>{const m=map('fps');m.updateViewPresentation();assert.equal(m.camera.fov,78);assert.equal(m.avatarGroup.visible,false);assert.equal(m.stationObjects[0].colMesh.visible,false);assert.ok(m.stationObjects[0].sprite.scale.x<.3);});
test('returning to orbit restores normal perspective, avatar and columns',()=>{const m=map('orbit');m.updateViewPresentation();assert.equal(m.camera.fov,48);assert.equal(m.avatarGroup.visible,true);assert.equal(m.stationObjects[0].colMesh.visible,true);assert.equal(m.stationObjects[0].sprite.scale.x,2.4);});
test('robot POV uses the wider perspective while keeping the other person visible',()=>{const m=map('robot');m.updateViewPresentation();assert.equal(m.camera.fov,78);assert.equal(m.avatarGroup.visible,true);assert.equal(m.stationObjects[0].colMesh.visible,false);});
