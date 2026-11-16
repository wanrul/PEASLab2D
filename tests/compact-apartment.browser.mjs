import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/peaslab-compact-browser';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[],graphicsErrors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(/GL_INVALID_VALUE|overflows texture dimensions/.test(message.text()))graphicsErrors.push(message.text());});
try {
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('#beginDesign');
 await page.waitForFunction(()=>window.map3d?.modelLoaded,{},{timeout:90000});
 await page.evaluate(async()=>{window.THREE=await import('/lib/three/three.module.js');window.state=(await import('/js/state.js')).appState;window.env=await import('/js/data/environment.js');window.world=simEngine.world;window.originalAvatar=world.avatar;map3d.renderer.setPixelRatio(.5);map3d.onResize();});
 assert.equal(await page.evaluate(()=>currentViewMode),'fps');
 const geometry=await page.evaluate(()=>{
  const model=map3d.apartmentModel;model.updateMatrixWorld(true);
  const mapPoint=point=>({x:130+(point.x+5)/17.5*950,y:90+(point.z+7.5)/15*920});
  const retained=p=>p.x<=1012.143+.01&&(p.x<=469.286+.01||p.y>=166.667-.01);
  const bad=[],closures=[];let vertices=0;
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const position=mesh.geometry.attributes.position;
   for(let index=0;index<position.count;index++){
    const point=new THREE.Vector3().fromBufferAttribute(position,index).applyMatrix4(mesh.matrixWorld);vertices++;
    if(!retained(mapPoint(point))&&bad.length<5)bad.push({name:mesh.name,...mapPoint(point)});
   }
   if(mesh.userData.layoutClosure){const box=new THREE.Box3().setFromObject(mesh);closures.push({name:mesh.name,height:box.max.y-box.min.y});}
  });
  const box=new THREE.Box3().setFromObject(model);
  return{layout:model.userData.apartmentLayoutId,vertices,bad,closures,maximum:mapPoint(box.max),width:box.max.x-box.min.x};
 });
 assert.equal(geometry.layout,'compact-v1');assert.ok(geometry.vertices>1000);assert.deepEqual(geometry.bad,[]);
 assert.deepEqual(geometry.closures.map(item=>item.name).sort(),['CompactApartmentClosureEast','CompactApartmentClosureNorth']);assert.ok(geometry.closures.every(item=>Math.abs(item.height-4)<1e-5));
 assert.ok(geometry.maximum.x<=1012.153);assert.ok(geometry.width<19,'the removed right strip reduces the actual model width');
 const targetData=await page.evaluate(()=>{
  const targets=env.getEnvironmentTargets(world),metrics=simEngine.getCleaningMetrics();
  const retained=p=>p.x<=1012.143&&(p.x<=469.286||p.y>=166.667);
  return{total:targets.length,dirt:world.dirtCells.map(item=>item.id),objects:world.objects.map(item=>item.id),spills:world.wetCells.map(item=>item.id),dock:{x:world.dock.x,y:world.dock.y},dockMarker:world.teleportMarkers.find(item=>item.id==='TP_DOCK'),invalid:targets.filter(item=>!retained(item.entity)||world.checkCollision(item.entity.x,item.entity.y,item.category==='person'?18:20)).map(item=>item.id),badFloor:[...simEngine.floorCoverageGrid.values()].filter(point=>!retained(point)),metrics};
 });
 assert.equal(targetData.total,20);assert.equal(targetData.dirt.length,11);assert.equal(targetData.metrics.dirtTotal,11);assert.deepEqual(targetData.invalid,[]);assert.deepEqual(targetData.badFloor,[]);assert.ok(targetData.metrics.floorTotalCells>0&&targetData.metrics.floorTotalCells<8945,'the fixed coverage denominator excludes the removed rooms');
 for(const id of['DIRT_0','DIRT_2','DIRT_6','DIRT_8','DIRT_11','DIRT_15'])assert.ok(!targetData.dirt.includes(id));assert.ok(!targetData.objects.includes('FOOD_1'));
 assert.deepEqual(targetData.spills,['WET_1','WET_2','WET_3']);assert.deepEqual(targetData.dock,{x:410,y:50});assert.equal(targetData.dockMarker.x,410);assert.equal(targetData.dockMarker.y,50);
 await page.locator('#beginDesign').click();await page.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await page.locator('#priorityContinue').click();
 assert.equal(await page.locator('#environmentProgress').innerText(),`0 / ${targetData.total} observed`);
 await page.locator('#viewWholeApartment').click();await page.waitForFunction(()=>currentViewMode==='3d');await page.waitForTimeout(100);
 const framing=await page.evaluate(()=>{const box=new THREE.Box3().setFromObject(map3d.apartmentModel),corners=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).project(map3d.camera));return corners.every(point=>Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1);});assert.equal(framing,true);
 await page.screenshot({path:`${artifacts}/compact-overview.png`});
 await page.evaluate(()=>switchViewMode('fps'));
 await page.locator('#dashboardMenu [data-step="2"]').click();await page.locator('#walkEnvironment').click();
 await page.evaluate(()=>{for(const target of env.getEnvironmentTargets(world)){if(target.id==='PERSON')continue;Object.assign(world.avatar,{x:target.entity.x,y:target.entity.y});state.observeEnvironment(world,'fps');}});
 assert.equal(await page.evaluate(()=>state.getEnvironmentProgress().observed),targetData.total-1);assert.equal(await page.locator('#environmentContinue').isDisabled(),true);assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has('PERSON')),false);
 await page.locator('#viewYourself').click();await page.waitForFunction(()=>state.canContinue(2));assert.equal(await page.locator('#environmentProgress').innerText(),`${targetData.total} / ${targetData.total} observed`);assert.equal(await page.locator('.environment-item.observed').count(),6);
 await page.keyboard.press('Escape');
 for(const wall of[{name:'North',x:425,y:80,mode:'fps',limit:463.857},{name:'East',x:960,y:700,mode:'thirdPerson',limit:1006.714}]){
  const approach=await page.evaluate(wall=>{
   switchViewMode(wall.mode);Object.assign(world.avatar,{x:wall.x,y:wall.y});map3d.fpsYaw=Math.PI/2;map3d.fpsPitch=0;
   const origin=map3d.to3D(wall.x,wall.y,1.1),ray=new THREE.Raycaster(origin,new THREE.Vector3(1,0,0),0,10),hit=ray.intersectObject(map3d.apartmentModel,true).find(item=>item.object.userData.layoutClosure);
   const robot=world.resolveMove(wall.x,wall.y,300,0,20);
   return{valid:!world.checkCollision(wall.x,wall.y,18),closure:hit?.object.name,robot};
  },wall);
  assert.equal(approach.valid,true);assert.equal(approach.closure,`CompactApartmentClosure${wall.name}`);assert.ok(approach.robot.x<=wall.limit-20+.02);
  await page.keyboard.press('Escape');await page.locator('#threeCanvas').focus();await page.keyboard.down('w');
  try{await page.waitForTimeout(650);}finally{await page.keyboard.up('w');}
  const stopped=await page.evaluate(()=>({x:world.avatar.x,y:world.avatar.y,valid:!world.checkCollision(world.avatar.x,world.avatar.y,world.avatar.radius),same:world.avatar===originalAvatar}));
  assert.equal(stopped.valid,true);assert.equal(stopped.same,true);assert.ok(stopped.x>wall.x+2&&stopped.x<=wall.limit-18+.02);assert.ok(Math.abs(stopped.y-wall.y)<.001);
  await page.screenshot({path:`${artifacts}/closure-${wall.name.toLowerCase()}.png`});
 }
 await page.locator('#dashboardMenu [data-step="2"]').click();
 const registry=await page.evaluate(()=>({labels:map3d.environmentLabels.map(item=>item.targetId).sort(),targets:env.getEnvironmentTargets(world).map(item=>item.id).sort()}));assert.deepEqual(registry.labels,registry.targets);
 await page.locator('[data-language="zh-CN"]').click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');assert.equal(await page.evaluate(()=>state.getEnvironmentProgress().observed),targetData.total);await page.screenshot({path:`${artifacts}/compact-observed-zh.png`});
 await page.keyboard.press('Escape');await page.evaluate(()=>switchViewMode('fallback'));await page.waitForTimeout(100);assert.equal(await page.locator('#houseCanvas').isVisible(),true);await page.screenshot({path:`${artifacts}/compact-fallback.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(graphicsErrors,[]);console.log(JSON.stringify({pass:true,actualTrimmedGeometry:true,closuresRaycast:true,fpsAndThirdPersonWallStops:true,robotBoundaries:true,allRetainedTargetsObserved:true,noOrphans:true,smallerFloorDenominator:targetData.metrics.floorTotalCells,actualTargets:targetData.total,bilingual:true,errors,graphicsErrors,artifacts}));
}finally{await page.keyboard.up('w').catch(()=>{});await browser.close();}
