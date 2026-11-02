import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const dir=process.env.ARTIFACT_DIR||'/private/tmp/peaslab-structured-browser';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://localhost:8092')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
try{
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('.overview');await page.evaluate(()=>{window.map3d?.renderer.setPixelRatio(.3);window.map3d?.onResize();});
 assert.equal(await page.locator('.overview-missions article').count(),3);await page.keyboard.press('Escape');assert.equal(await page.locator('.overview').isVisible(),true);await page.evaluate(()=>openStepModal(3));assert.equal(await page.locator('.overview').isVisible(),true);
 await page.screenshot({path:`${dir}/overview.png`});await page.locator('#beginDesign').click();assert.equal(await page.locator('[data-task-purpose]').count(),1);
 await page.locator('[data-task-purpose]').fill('My literal 设计');await page.locator('[data-task-purpose]').blur();await page.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await page.locator('#priorityContinue').click();
 await page.evaluate(async()=>{window.testState=(await import('/js/state.js')).appState;testState.unlockedStep=5;openStepModal(4);});await page.waitForFunction(()=>window.robotBlockWorkspace);
 await page.evaluate(()=>{
  window.ws=robotBlockWorkspace;window.make=(type,x,y)=>{const b=ws.newBlock(type);b.initSvg();b.render();b.moveBy(x,y);return b;};
  window.head=make('PEAS_BEHAVIOR',190,40);window.first=make('ACT_18',610,80);window.second=make('ACT_20',620,180);
 });
 const dragConnect=async(blockName,targetName,inputName)=>{
  const points=await page.evaluate(({blockName,targetName,inputName})=>{
   const b=window[blockName],t=window[targetName],from=b.previousConnection,to=(inputName?t.getInput(inputName).connection:t.nextConnection);const rect=b.getSvgRoot().getBoundingClientRect();const matrix=ws.getCanvas().getScreenCTM();return {x:rect.x+35,y:rect.y+15,dx:(to.x-from.x)*matrix.a,dy:(to.y-from.y)*matrix.d};
  },{blockName,targetName,inputName});
  await page.mouse.move(points.x,points.y);await page.mouse.down();await page.mouse.move(points.x+points.dx,points.y+points.dy,{steps:25});await page.mouse.up();await page.waitForTimeout(250);
 };
 console.log('Overview and purpose passed; testing mouse connections');
 await dragConnect('first','head','BODY');assert.equal(await page.evaluate(()=>head.getInputTargetBlock('BODY')===first),true,'mouse drag snaps action into nested behavior');
 await dragConnect('second','first',null);assert.equal(await page.evaluate(()=>first.getNextBlock()===second),true,'mouse drag snaps ordered actions');
 // Move the second action before the first: a real drag reorders the statement stack.
 await dragConnect('second','head','BODY');assert.equal(await page.evaluate(()=>head.getInputTargetBlock('BODY')===second&&second.getNextBlock()===first),true,'mouse drag reorders sequence');
 await page.evaluate(()=>{
  window.branch=make('controls_if',620,300);branch.loadExtraState({elseIfCount:1,hasElse:true});
  const c=make('COND_03',0,0),sense=make('SENSE_05',0,0),c2=make('COND_04',0,0),sense2=make('SENSE_06',0,0);
  c.getInput('SENSOR').connection.connect(sense.outputConnection);c2.getInput('SENSOR').connection.connect(sense2.outputConnection);branch.getInput('IF0').connection.connect(c.outputConnection);branch.getInput('IF1').connection.connect(c2.outputConnection);
  const a=make('ACT_09',0,0),b=make('ACT_11',0,0);branch.getInput('DO0').connection.connect(a.previousConnection);branch.getInput('DO1').connection.connect(b.previousConnection);branch.render();
 });
 await dragConnect('branch','first',null);assert.equal(await page.evaluate(()=>first.getNextBlock()===branch),true,'mouse drag nests IF / ELSE IF / ELSE');
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>testState.program[0].body[2].branches.length),2);
 console.log('Mouse snap/nest/reorder passed; testing language');
 const before=await page.evaluate(()=>{window.savedWorkspace=ws;return {program:JSON.stringify(testState.program),draft:JSON.stringify(testState.blockWorkspace),x:ws.scrollX,y:ws.scrollY,scale:ws.scale};});
 await page.locator('[data-language="zh-CN"]').click();await page.waitForTimeout(200);
 assert.deepEqual(await page.evaluate(()=>({program:JSON.stringify(testState.program),draft:JSON.stringify(testState.blockWorkspace),x:ws.scrollX,y:ws.scrollY,scale:ws.scale})),before);assert.equal(await page.evaluate(()=>savedWorkspace===robotBlockWorkspace),true);assert.match(await page.locator('.structured-editor header').innerText(),/拼接/);
 await page.screenshot({path:`${dir}/nested-zh.png`});
 // Live preview highlights a real authored node; no formal history is created.
 await page.evaluate(()=>{testState.installedActuators.add('ACTUATOR_LED');startRulePreview();});await page.waitForTimeout(350);assert.ok(await page.locator('.blocklyHighlightedConnectionPath,.blocklyHighlighted').count());await page.evaluate(()=>simEngine.stopPreview());assert.equal(await page.evaluate(()=>testState.runHistory.length),0);
 await page.evaluate(()=>showOverview());await page.locator('#beginDesign').click();assert.equal(await page.evaluate(()=>savedWorkspace===robotBlockWorkspace),true);
 // Stage carryover and final combined feedback use actual physics, never artificial pass counters.
 await page.evaluate(async()=>{const {authorStructuredSolution}=await import('/tests/fixtures/structured-solution.mjs');window.authorSolution=authorStructuredSolution;window.stages=(await import('/js/pilot-config.js')).PILOT_STAGES;simEngine.stopPreview();testState.currentStage=3;testState.selectedTasks=[...stages[2].taskIds];testState.stagePurposes[3]=testState.createStagePurposes(3);testState.stageResults[3]={passingRunId:null,closingText:''};testState.currentStep=1;testState.notify('stageChanged',{stageId:3});authorSolution(3);testState.unlockedStep=5;openStepModal(5);simEngine.start();simEngine.pause();Object.assign(simEngine.world.avatar,simEngine.world.teleportMarkers.find(m=>m.id==='TP_LIVING'));});
 await page.evaluate(async()=>{for(let i=0;i<25000&&!simEngine.criteriaResults.every(c=>c.status==='Achieved');i++){simEngine.tick();if(i%500===0)await new Promise(r=>setTimeout(r,0));}window.finalRun=simEngine.endRun('evaluate');});
 const final=await page.evaluate(()=>({passed:finalRun.passed,ticks:finalRun.tick,battery:simEngine.world.robot.battery,settings:finalRun.simulationSettings,program:finalRun.configuration.program.length}));assert.equal(final.passed,true);assert.equal(final.settings.initialBatteryPercent,35);assert.ok(final.program>0);assert.match(await page.locator('#criterionResults').innerText(),/已达成|已达到|达成|已实现|Achieved/);
 await page.screenshot({path:`${dir}/final-feedback.png`});await page.setViewportSize({width:800,height:900});await page.screenshot({path:`${dir}/narrow.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({pass:true,dragSnapReorder:true,languageIdentity:true,final,errors,external,artifacts:dir}));
}finally{await browser.close();}
