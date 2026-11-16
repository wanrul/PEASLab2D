import assert from 'node:assert/strict';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://localhost:8093');await page.waitForSelector('#beginDesign');await page.waitForFunction(()=>window.map3d?.modelLoaded,null,{timeout:90000});
 await page.locator('#beginDesign').click();assert.equal(await page.locator('[data-task-priority]').count(),2);
 assert.match(await page.locator('.cleaning-goals').innerText(),/Thorough cleaning/);assert.match(await page.locator('.cleaning-goals').innerText(),/Speed/);assert.match(await page.locator('.cleaning-goals').innerText(),/40 simulation minutes/);assert.match(await page.locator('.cleaning-goals').innerText(),/20 simulation minutes/);
 await page.locator('[data-task-priority="TASK_1"][value="speed"]').check();await page.screenshot({path:'/private/tmp/peaslab-restored-measurement.png'});await page.locator('#priorityContinue').click();
 await page.evaluate(async()=>{window.s=(await import('/js/state.js')).appState;map3d.renderer.setPixelRatio(.5);map3d.onResize();});
 await page.locator('#viewWholeApartment').click();assert.equal(await page.evaluate(()=>currentViewMode),'3d');assert.equal(await page.evaluate(()=>s.environmentWalkingEnabled),true);
 const start=await page.evaluate(async()=>{
  const T=await import('/lib/three/three.module.js'),env=await import('/js/data/environment.js'),w=simEngine.world;
  const f=map3d.camera.getWorldDirection(new T.Vector3());f.y=0;f.normalize();const right=new T.Vector3().crossVectors(f,new T.Vector3(0,1,0)).normalize();const dx=right.x*950/17.5,dy=right.z*920/15,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  for(const target of env.getEnvironmentTargets(w).filter(t=>t.category==='dirt')){
   const x=target.entity.x-ux*110,y=target.entity.y-uy*110;
   if([0,10,20,30,40,50,60,70].some(d=>w.checkCollision(x+ux*d,y+uy*d,w.avatar.radius)))continue;
   if(!env.hasEnvironmentLineOfSight({x,y},target.entity))continue;
   Object.assign(w.avatar,{x,y,targetX:null,targetY:null});s.observedEnvironmentTargets.clear();window.walkedTargetId=target.id;return {id:target.id,x,y};
  }
  throw new Error('No suitable unobstructed dirt approach found');
 });
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>s.observedEnvironmentTargets.has(walkedTargetId)),false);
 await page.locator('#threeCanvas').focus();await page.keyboard.down('d');await page.waitForFunction(()=>s.observedEnvironmentTargets.has(walkedTargetId),null,{timeout:5000});await page.keyboard.up('d');
 const walked=await page.evaluate(()=>({position:{x:simEngine.world.avatar.x,y:simEngine.world.avatar.y},count:s.getEnvironmentProgress(),person:s.observedEnvironmentTargets.has('PERSON')}));assert.ok(Math.hypot(walked.position.x-start.x,walked.position.y-start.y)>25);assert.equal(walked.person,true);
 const count=walked.count.observed;await page.mouse.move(300,400);await page.mouse.wheel(0,100);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>s.getEnvironmentProgress().observed),count);
 await page.screenshot({path:'/private/tmp/peaslab-3d-observed.png'});
 await page.evaluate(()=>{s.stageResults[1].passingRunId=1;s.continueStage();openStepModal(1);});assert.equal(await page.locator('[data-task-priority]').count(),2);assert.equal(await page.locator('[value="speed"]').isChecked(),true);assert.equal(await page.locator('#priorityContinue').isDisabled(),false);
 await page.evaluate(()=>{s.stageResults[2].passingRunId=2;s.continueStage();openStepModal(1);});assert.equal(await page.locator('[data-task-priority]').count(),2);assert.equal(await page.locator('#priorityContinue').isDisabled(),false);
 await page.evaluate(()=>openStepModal(1));await page.locator('[data-language="zh-CN"]').click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');assert.match(await page.locator('.cleaning-goals').innerText(),/40 分钟/);assert.match(await page.locator('.cleaning-goals').innerText(),/20 分钟/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,twoOriginalOptions:true,real3DWalkingObservation:true,noZoomCredit:true,personVisibleIn3D:true,bilingual:true,start,walked,errors}));
}finally{await browser.close();}
