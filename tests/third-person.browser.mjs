import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/peaslab-third-person-browser';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[],graphicsErrors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(/GL_INVALID_VALUE|overflows texture dimensions/.test(message.text()))graphicsErrors.push(message.text());});
const language=async value=>{await page.locator(`[data-language="${value}"]`).click();await page.waitForFunction(value=>document.documentElement.lang===value,value);};
const renderedPersonPixel=()=>page.evaluate(async()=>{
 const THREE=await import('/lib/three/three.module.js'),texture=map3d.environmentLabels.find(item=>item.targetId==='PERSON').label.material.map;
 const scene=new THREE.Scene(),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,toneMapped:false,depthTest:false,transparent:true}));
 sprite.scale.set(2,2,1);scene.add(sprite);
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
 const target=new THREE.WebGLRenderTarget(256,64),previous=map3d.renderer.getRenderTarget(),pixel=new Uint8Array(4);
 try{map3d.renderer.setRenderTarget(target);map3d.renderer.render(scene,camera);map3d.renderer.readRenderTargetPixels(target,32,10,1,1,pixel);}
 finally{map3d.renderer.setRenderTarget(previous);target.dispose();sprite.material.dispose();}
 return [...pixel];
});
const assertRenderedGreen=pixel=>{assert.equal(pixel[3],255);assert.ok(pixel[1]>pixel[0]+10&&pixel[1]>pixel[2]+10,`the actual uploaded label must render green: ${pixel}`);};
try {
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('#beginDesign');
 await page.waitForFunction(()=>window.map3d?.modelLoaded,{},{timeout:90000});
 await page.evaluate(async()=>{map3d.renderer.setPixelRatio(.5);map3d.onResize();window.state=(await import('/js/state.js')).appState;window.world=simEngine.world;window.envModule=await import('/js/data/environment.js');window.avatarIdentity=world.avatar;window.avatarGroupIdentity=map3d.avatarGroup;window.initialEntities=Object.keys(world);window.THREE=await import('/lib/three/three.module.js');window.playerFrame=()=>{const box=new THREE.Box3().setFromObject(map3d.avatarGroup),points=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(map3d.camera));return{height:(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))/2,inside:points.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1),pose:{x:world.avatar.x,y:world.avatar.y}};};});
 const targetTotal=await page.evaluate(()=>envModule.getEnvironmentTargets(world).length);
 assert.equal(await page.evaluate(()=>currentViewMode),'fps');assert.equal(await page.evaluate(()=>map3d.avatarGroup.visible),false);
 assert.equal(await page.locator('#viewModeFpsBtn').evaluate(node=>node.classList.contains('active')),true);
 await page.evaluate(()=>switchViewMode('thirdPerson'));await page.waitForTimeout(250);
 const initialFrame=await page.evaluate(()=>playerFrame());await page.screenshot({path:`${artifacts}/third-person-initial.png`});
 assert.deepEqual(initialFrame.pose,{x:130,y:645});assert.ok(initialFrame.height<.7,`initial player fills ${(initialFrame.height*100).toFixed(1)}% of the frame`);assert.equal(initialFrame.inside,true,'every initial player bounding-box corner is inside the camera frame');
 await page.locator('#viewModeFpsBtn').click();
 await page.locator('#beginDesign').click();await page.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await page.locator('#priorityContinue').click();
 await page.evaluate(()=>{for(const target of envModule.getEnvironmentTargets(world)){if(target.id==='PERSON')continue;Object.assign(world.avatar,{x:target.entity.x,y:target.entity.y});state.observeEnvironment(world,'fps');}});
 assert.equal(await page.evaluate(()=>state.getEnvironmentProgress().observed),targetTotal-1);assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has('PERSON')),false);
 assert.equal(await page.locator('#environmentContinue').isDisabled(),true);
 await page.locator('#viewWholeApartment').click();await page.waitForFunction(()=>currentViewMode==='3d'&&!state.environmentWalkingEnabled);
 await page.locator('#quickPovBtn').click();await page.waitForFunction(()=>state.isRobotPovActive&&currentViewMode==='robot');
 await page.evaluate(()=>switchViewMode('thirdPerson'));await page.waitForFunction(()=>!state.isRobotPovActive&&currentViewMode==='thirdPerson'&&state.environmentWalkingEnabled&&state.observedEnvironmentTargets.has('PERSON'));
 await page.locator('#dashboardMenu [data-step="2"]').click();await page.locator('#viewYourself').click();
 await page.waitForTimeout(150);
 const self=await page.evaluate(()=>{const label=map3d.environmentLabels.find(item=>item.targetId==='PERSON').label;return{visible:map3d.avatarGroup.visible,fov:map3d.camera.fov,observed:label.userData.observed,name:label.userData.environmentLabel,pixel:[...label.material.map.image.getContext('2d').getImageData(8,30,1,1).data],count:state.getEnvironmentProgress().observed,sameAvatar:world.avatar===avatarIdentity,sameGroup:map3d.avatarGroup===avatarGroupIdentity,entities:Object.keys(world)};});
 assert.equal(self.visible,true);assert.equal(self.fov,68);assert.equal(self.observed,true);assert.equal(self.name,'Person');assert.deepEqual(self.pixel,[220,252,231,255]);assert.equal(self.count,targetTotal);assert.equal(self.sameAvatar,true);assert.equal(self.sameGroup,true);assert.deepEqual(self.entities,await page.evaluate(()=>initialEntities));
 assertRenderedGreen(await renderedPersonPixel());
 assert.equal(await page.locator('#environmentContinue').isEnabled(),true);
 console.log('FPS remains the default; all other locations leave Person locked until the existing player is viewed in Third person.');
 await page.keyboard.press('Escape');
 const route=await page.evaluate(()=>{
  for(const target of world.dirtCells)for(let i=0;i<48;i++){
   const angle=i*Math.PI/24,dx=Math.cos(angle),dy=Math.sin(angle),start={x:target.x-dx*80,y:target.y-dy*80};
   if(world.checkCollision(start.x,start.y,world.avatar.radius))continue;
   const end=world.resolveMove(start.x,start.y,dx*120,dy*120,world.avatar.radius);
   if(Math.hypot(end.x-start.x-dx*120,end.y-start.y-dy*120)>.01)continue;
   Object.assign(world.avatar,start);map3d.fpsYaw=Math.atan2(dx/(950/17.5),dy/(920/15));map3d.fpsPitch=-.2;map3d.updateFpsLocomotion(0);
   window.moveStart={x:world.avatar.x,y:world.avatar.y};window.cameraStart=map3d.camera.position.toArray();return{dx,dy};
  }
  return null;
 });assert.ok(route,'an open real room route exists');
 await page.locator('#threeCanvas').focus();await page.keyboard.down('w');
 try{await page.waitForFunction(()=>Math.hypot(world.avatar.x-moveStart.x,world.avatar.y-moveStart.y)>35,{},{timeout:10000});assert.equal(await page.evaluate(()=>{const before={x:world.avatar.x,y:world.avatar.y};houseCanvas.updateAvatar();return world.avatar.x===before.x&&world.avatar.y===before.y;}),true,'the hidden 2D renderer must not also move the player');}finally{await page.keyboard.up('w');}
 await page.waitForTimeout(150);
 const moved=await page.evaluate(()=>({distance:Math.hypot(world.avatar.x-moveStart.x,world.avatar.y-moveStart.y),cameraDistance:Math.hypot(...map3d.camera.position.toArray().map((v,i)=>v-cameraStart[i])),valid:!world.checkCollision(world.avatar.x,world.avatar.y,world.avatar.radius),projected:map3d.avatarGroup.position.clone().add({x:0,y:.8,z:0}).project(map3d.camera).toArray(),visible:map3d.avatarGroup.visible}));
 assert.ok(moved.distance>35);assert.ok(moved.cameraDistance>.2);assert.equal(moved.valid,true);assert.equal(moved.visible,true);assert.ok(Math.abs(moved.projected[0])<1&&Math.abs(moved.projected[1])<1&&Math.abs(moved.projected[2])<1,'the controlled player remains inside the third-person camera frame');
 const dragBefore=await page.evaluate(()=>({yaw:map3d.fpsYaw,pitch:map3d.fpsPitch,x:world.avatar.x,y:world.avatar.y}));
 await page.mouse.move(220,420);await page.mouse.down();await page.mouse.move(340,455,{steps:6});await page.mouse.up();await page.waitForTimeout(100);
 const dragAfter=await page.evaluate(()=>({yaw:map3d.fpsYaw,pitch:map3d.fpsPitch,x:world.avatar.x,y:world.avatar.y}));
 assert.ok(Math.abs(dragAfter.yaw-dragBefore.yaw)>.2);assert.ok(Math.abs(dragAfter.pitch-dragBefore.pitch)>.05);assert.equal(dragAfter.x,dragBefore.x);assert.equal(dragAfter.y,dragBefore.y);
 console.log(`Third-person real W-key travel ${moved.distance.toFixed(1)} map units, camera follow, visible player and mouse orbit passed.`);
 const wall=await page.evaluate(()=>{
  for(let y=100;y<1100;y+=24)for(let x=100;x<1200;x+=24){
   if(world.checkCollision(x,y,world.avatar.radius))continue;
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
    const end={x:x+dx*100,y:y+dy*100},resolved=world.resolveMove(x,y,dx*100,dy*100,world.avatar.radius),travel=Math.hypot(resolved.x-x,resolved.y-y);
    if(travel<15||travel>65||envModule.hasEnvironmentLineOfSight({x,y},end))continue;
    Object.assign(world.avatar,{x,y});map3d.fpsYaw=Math.atan2(dx/(950/17.5),dy/(920/15));map3d.fpsPitch=-.2;window.wallStart={x,y};return{dx,dy,travel};
   }
  }
  return null;
 });assert.ok(wall,'a valid approach to an actual apartment wall exists');
 await page.locator('#threeCanvas').focus();await page.keyboard.down('w');
 let wallSettled;
 try{await page.waitForTimeout(900);wallSettled=await page.evaluate(()=>({x:world.avatar.x,y:world.avatar.y}));await page.waitForTimeout(250);}finally{await page.keyboard.up('w');}
 const wallAfter=await page.evaluate(()=>({x:world.avatar.x,y:world.avatar.y,valid:!world.checkCollision(world.avatar.x,world.avatar.y,world.avatar.radius),los:envModule.hasEnvironmentLineOfSight(wallStart,world.avatar),travel:Math.hypot(world.avatar.x-wallStart.x,world.avatar.y-wallStart.y)}));
 assert.equal(wallAfter.valid,true);assert.equal(wallAfter.los,true);assert.ok(wallAfter.travel>5&&wallAfter.travel<70);assert.ok(Math.hypot(wallAfter.x-wallSettled.x,wallAfter.y-wallSettled.y)<.01,'holding W against the wall cannot push the player through');
 const wallFrame=await page.evaluate(()=>playerFrame());await page.screenshot({path:`${artifacts}/third-person-at-wall.png`});assert.ok(wallFrame.height<.7,`wall player fills ${(wallFrame.height*100).toFixed(1)}% of the frame`);assert.equal(wallFrame.inside,true,'every player bounding-box corner stays inside the frame near a wall');
 console.log(`Whole-player framing: initial ${(initialFrame.height*100).toFixed(1)}%, at wall ${(wallFrame.height*100).toFixed(1)}%.`);
 const beforePov=await page.evaluate(()=>({mode:currentViewMode,yaw:map3d.fpsYaw,pitch:map3d.fpsPitch,pose:{x:world.avatar.x,y:world.avatar.y},sensors:[...state.installedSensors],group:map3d.avatarGroup.uuid}));
 await page.locator('#quickPovBtn').click();await page.waitForFunction(()=>state.isRobotPovActive&&currentViewMode==='robot');await page.keyboard.press('Escape');await page.waitForFunction(()=>!state.isRobotPovActive&&currentViewMode==='thirdPerson');
 const afterPov=await page.evaluate(()=>({mode:currentViewMode,yaw:map3d.fpsYaw,pitch:map3d.fpsPitch,pose:{x:world.avatar.x,y:world.avatar.y},sensors:[...state.installedSensors],group:map3d.avatarGroup.uuid}));assert.deepEqual(afterPov,beforePov);assert.equal(await page.evaluate(()=>map3d.avatarGroup.visible),true);
 const physical=await page.evaluate(()=>{state.installedSensors.add('SENSE_09');const before=simEngine.readSensors().SENSE_09;map3d.updateEnvironmentLabels();map3d.updateThirdPersonCamera();const after=simEngine.readSensors().SENSE_09;state.installedSensors.delete('SENSE_09');return{before,after,same:world.avatar===avatarIdentity&&map3d.avatarGroup===avatarGroupIdentity,program:state.program.length,sensors:state.installedSensors.size,actuators:state.installedActuators.size};});
 assert.equal(physical.before,physical.after);assert.equal(physical.same,true);assert.equal(physical.program,0);assert.equal(physical.sensors,0);assert.equal(physical.actuators,0);
 await page.screenshot({path:`${artifacts}/third-person-en.png`});const observations=await page.evaluate(()=>JSON.stringify([...state.observedEnvironmentTargets]));
 await language('zh-CN');assert.match(await page.locator('[data-environment-view="thirdPerson"]').textContent(),/第三人称/);assert.equal(await page.evaluate(()=>currentViewMode),'thirdPerson');assert.equal(await page.evaluate(()=>JSON.stringify([...state.observedEnvironmentTargets])),observations);assert.equal(await page.evaluate(()=>world.avatar===avatarIdentity&&map3d.avatarGroup===avatarGroupIdentity),true);
 assertRenderedGreen(await renderedPersonPixel());
 await page.screenshot({path:`${artifacts}/third-person-zh.png`});await language('en');assert.match(await page.locator('[data-environment-view="thirdPerson"]').textContent(),/Third person/);
 await page.locator('#viewModeFpsBtn').click();assert.equal(await page.evaluate(()=>map3d.avatarGroup.visible),false);await page.evaluate(()=>switchViewMode('thirdPerson'));assert.equal(await page.evaluate(()=>map3d.avatarGroup.visible),true);
 assert.deepEqual(errors,[]);assert.deepEqual(graphicsErrors,[]);console.log(JSON.stringify({pass:true,defaultFps:true,personRequiresSelfView:true,realWalking:true,cameraFollow:true,wholePlayerFramed:true,hiddenFallbackDoesNotMove:true,mouseLook:true,wallCollision:true,samePlayerNoNpc:true,physicalPerceptsUnchanged:true,povReturn:true,overviewPovToThirdPerson:true,bilingual:true,actualGpuLabelGreen:true,errors,graphicsErrors,artifacts}));
}finally{await page.keyboard.up('w').catch(()=>{});await browser.close();}
