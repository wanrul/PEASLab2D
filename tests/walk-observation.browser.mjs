import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const artifacts=process.env.ARTIFACT_DIR||'/private/tmp/peaslab-walk-browser';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const switchLanguage=async language=>{await page.locator(`[data-language="${language}"]`).click();await page.waitForFunction(value=>document.documentElement.lang===value,language);};
try {
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('#beginDesign');
 await page.waitForFunction(()=>window.map3d?.modelLoaded,{},{timeout:90000});
 await page.evaluate(()=>{map3d.renderer.setPixelRatio(.5);map3d.onResize();});
 await page.locator('#beginDesign').click();
 assert.match(await page.locator('.cleaning-goals').innerText(),/About 40 simulation minutes/);
 assert.match(await page.locator('.cleaning-goals').innerText(),/About 20 simulation minutes/);
 await switchLanguage('zh-CN');assert.match(await page.locator('.cleaning-goals').innerText(),/40 分钟/);assert.match(await page.locator('.cleaning-goals').innerText(),/20 分钟/);
 await switchLanguage('en');await page.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await page.locator('#priorityContinue').click();
 await page.evaluate(async()=>{window.state=(await import('/js/state.js')).appState;window.envModule=await import('/js/data/environment.js');window.world=simEngine.world;window.targets=envModule.getEnvironmentTargets(world);window.avatarIdentity=world.avatar;});
 const targetTotal=await page.evaluate(()=>targets.length);
 assert.equal(await page.locator('[data-environment-category]').count(),6);
 assert.equal(await page.locator('.environment-step input[type="checkbox"]').count(),0);
 assert.equal(await page.evaluate(()=>state.setEnvironmentObservation),undefined);
 const layout=await page.evaluate(()=>{const rect=node=>node.getBoundingClientRect().toJSON();const cards=[...document.querySelectorAll('[data-environment-category]')].map(rect);return{canvas:rect(document.querySelector('.fullscreen-house-container')),panel:rect(document.querySelector('.step-modal-dialog')),columns:new Set(cards.map(card=>Math.round(card.x))).size,rows:new Set(cards.map(card=>Math.round(card.y))).size,bottomElement:document.elementFromPoint(innerWidth*.65,innerHeight-5)?.id};});
 assert.equal(layout.canvas.width,1512);assert.equal(layout.canvas.height,1000);assert.ok(Math.abs(layout.panel.width-1512*.4)<1);
 assert.equal(layout.columns,2);assert.equal(layout.rows,3);assert.ok(layout.panel.bottom<=988.1);assert.equal(layout.bottomElement,'threeCanvas');
 console.log('Readonly six-card observation UI, full-scene underlay,40% panel and budget translations passed.');
 await page.locator('#viewWholeApartment').click();
 const overhead=await page.evaluate(()=>{
  const target=targets.find(item=>item.category==='dirt'&&!state.observedEnvironmentTargets.has(item.id));
  window.overheadTarget=target.id;Object.assign(world.avatar,{x:target.entity.x,y:target.entity.y});return{count:state.observedEnvironmentTargets.size,id:target.id};
 });
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.size),overhead.count);assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has(overheadTarget)),false);
 assert.equal(await page.locator('#environmentContinue').isDisabled(),true);
 await page.locator('#dashboardMenu [data-step="2"]').click();
 await page.locator('#walkEnvironment').click();await page.waitForFunction(()=>currentViewMode==='fps');
 const los=await page.evaluate(()=>{
  for(const target of targets.filter(item=>item.category!=='person'&&!state.observedEnvironmentTargets.has(item.id)))for(const distance of[70,79])for(let i=0;i<48;i++){
   const angle=i*Math.PI/24,pose={x:target.entity.x+Math.cos(angle)*distance,y:target.entity.y+Math.sin(angle)*distance};
   if(!world.checkCollision(pose.x,pose.y,world.avatar.radius)&&!envModule.hasEnvironmentLineOfSight(pose,target.entity)){
    window.wallTarget=target.id;Object.assign(world.avatar,pose);return{id:target.id,distance};
   }
  }
  return null;
 });
 assert.ok(los,'there is a real target within range across a model wall');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has(wallTarget)),false);
 const walking=await page.evaluate(()=>{
  const candidates=targets.filter(item=>item.category==='dirt'&&!state.observedEnvironmentTargets.has(item.id));
  const others=targets.filter(item=>item.category!=='person');
  window.withheld=candidates.map(target=>({target,nearest:Math.min(...others.filter(item=>item.id!==target.id).map(item=>Math.hypot(item.entity.x-target.entity.x,item.entity.y-target.entity.y)))})).sort((a,b)=>b.nearest-a.nearest)[0].target;
  for(const target of candidates.filter(item=>item.id!==withheld.id))for(let i=0;i<48;i++){
   const angle=i*Math.PI/24,dx=Math.cos(angle),dy=Math.sin(angle),start={x:target.entity.x-dx*130,y:target.entity.y-dy*130};
   if(world.checkCollision(start.x,start.y,world.avatar.radius))continue;
   const result=world.resolveMove(start.x,start.y,dx*80,dy*80,world.avatar.radius);
   if(Math.hypot(result.x-start.x-dx*80,result.y-start.y-dy*80)>.01)continue;
   if(Math.hypot(start.x-withheld.entity.x,start.y-withheld.entity.y)<100)continue;
   window.walkTarget=target.id;Object.assign(world.avatar,start);map3d.fpsYaw=Math.atan2(dx/(950/17.5),dy/(920/15));map3d.fpsPitch=-.3;
   const entry=map3d.environmentLabels.find(item=>item.targetId===target.id),context=entry.label.material.map.image.getContext('2d'),fill=context.fillText.bind(context);
   context.fillText=(text,...args)=>{window.walkCaption=text;return fill(text,...args);};
   window.walkBefore={x:world.avatar.x,y:world.avatar.y};return{id:target.id,withheld:withheld.id};
  }
  return null;
 });
 assert.ok(walking,'a real unobstructed walking approach exists');assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has(walkTarget)),false);
 await page.locator('#threeCanvas').focus();await page.keyboard.down('w');
 try{await page.waitForFunction(()=>state.observedEnvironmentTargets.has(walkTarget),{},{timeout:10000});}finally{await page.keyboard.up('w');}
 await page.waitForTimeout(100);
 const walkResult=await page.evaluate(()=>{const item=map3d.environmentLabels.find(item=>item.targetId===walkTarget);return{distance:Math.hypot(world.avatar.x-walkBefore.x,world.avatar.y-walkBefore.y),observed:item.label.userData.observed,caption:walkCaption,pixel:[...item.label.material.map.image.getContext('2d').getImageData(8,30,1,1).data]};});
 assert.ok(walkResult.distance>30);assert.equal(walkResult.observed,true);assert.equal(walkResult.caption,'✓ Dirt');assert.deepEqual(walkResult.pixel,[220,252,231,255]);
 console.log(`Real W-key walk earned ${walking.id} after ${walkResult.distance.toFixed(1)} map units; green checkmark+name confirmed; overhead and wall LOS did not earn observations.`);
 await page.evaluate(()=>{for(const target of targets){if(target.id===withheld.id)continue;Object.assign(world.avatar,{x:target.entity.x,y:target.entity.y});state.observeEnvironment(world,'fps');}});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has(withheld.id)),false);
 assert.equal(await page.evaluate(()=>state.getEnvironmentProgress().observed),targetTotal-2);assert.equal(await page.locator('#environmentContinue').isDisabled(),true);
 assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has('PERSON')),false);
 await page.evaluate(()=>{Object.assign(world.avatar,{x:withheld.entity.x,y:withheld.entity.y});});
 await page.waitForFunction(total=>state.getEnvironmentProgress().observed===total-1,targetTotal);
 assert.equal(await page.evaluate(()=>state.observedEnvironmentTargets.has('PERSON')),false);assert.equal(await page.locator('#environmentContinue').isDisabled(),true);
 await page.locator('#viewYourself').click();await page.waitForFunction(()=>currentViewMode==='thirdPerson'&&state.canContinue(2));
 assert.equal(await page.locator('#environmentContinue').isEnabled(),true);
 assert.equal(await page.locator('#environmentProgress').innerText(),`${targetTotal} / ${targetTotal} observed`);
 assert.equal(await page.locator('.environment-item.observed').count(),6);
 const retained=await page.evaluate(()=>JSON.stringify([...state.observedEnvironmentTargets]));
 await switchLanguage('zh-CN');assert.match(await page.locator('.environment-step').innerText(),/观察|查看/);assert.equal(await page.evaluate(()=>JSON.stringify([...state.observedEnvironmentTargets])),retained);
 assert.match(await page.evaluate(()=>walkCaption),/^✓ .*?[\u3400-\u9fff]/);
 const physical=await page.evaluate(()=>{
  const before={sensors:[...state.installedSensors],actuators:[...state.installedActuators],program:JSON.stringify(state.program),robot:{x:world.robot.x,y:world.robot.y}};
  state.installedSensors.add('SENSE_09');const percept=simEngine.readSensors().SENSE_09;map3d.updateEnvironmentLabels();const after=simEngine.readSensors().SENSE_09;state.installedSensors.delete('SENSE_09');
  return{before,after:{sensors:[...state.installedSensors],actuators:[...state.installedActuators],program:JSON.stringify(state.program),robot:{x:world.robot.x,y:world.robot.y}},sameAvatar:world.avatar===avatarIdentity,percept,afterPercept:after};
 });
 assert.deepEqual(physical.after,physical.before);assert.equal(physical.sameAvatar,true);assert.equal(physical.percept,physical.afterPercept);
 await page.screenshot({path:`${artifacts}/observed-zh.png`});await switchLanguage('en');await page.locator('#environmentContinue').click();
 assert.equal(await page.evaluate(()=>state.currentStep),3);assert.equal(await page.locator('.module-card').count(),15);
 await page.screenshot({path:`${artifacts}/sensors-unlocked.png`});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,realWalking:true,overheadNoCredit:true,wallLineOfSight:true,allLocations:true,lastLocationGate:true,personRequiresSelfView:true,greenCheckName:true,languagePersistence:true,fullUnderlay:true,panel40Percent:true,cards2By3:true,physicalPerceptsUnchanged:true,errors,artifacts}));
}finally{await page.keyboard.up('w').catch(()=>{});await browser.close();}
