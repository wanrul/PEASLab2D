import assert from 'node:assert/strict';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const base=process.env.TEST_URL||'http://localhost:8093';
try{
 const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?preview=logic-answer');await page.waitForFunction(()=>window.simEngine);await page.waitForTimeout(700);
 const entry=await page.evaluate(async()=>{const s=(await import('/js/state.js')).appState;return {step:s.currentStep,preview:s.localPreview,program:s.program.length,goal:s.stagePurposes[1].TASK_1.priority,sensors:s.installedSensors.size,actuators:s.installedActuators.size};});
 assert.equal(entry.step,5);assert.equal(entry.preview,true);assert.equal(entry.goal,'speed');
 await page.waitForSelector('#logicBoardDialog[open]');assert.equal(entry.sensors,6);assert.equal(entry.actuators,4);assert.equal(entry.program,8);
 const data=await page.evaluate(()=>({types:robotBlockWorkspace.getTopBlocks().map(b=>b.type),emptyIfs:robotBlockWorkspace.getAllBlocks().filter(b=>b.type==='controls_if'&&!b.getInputTargetBlock('IF0')).length,paused:!simEngine.previewActive,diagnostics:document.querySelector('.program-status').innerText}));
 assert.equal(data.emptyIfs,0);assert.equal(data.paused,true);assert.equal(data.types.filter(t=>t==='LEARNER_BEHAVIOR').length,4);assert.equal(data.types.filter(t=>t==='LEARNER_DEFINE').length,4);
 await page.screenshot({path:'/private/tmp/peaslab-answer-preview.png'});
 const run=await page.evaluate(()=>{simEngine.stopPreview();simEngine.reset();simEngine.start();simEngine.pause();let ticks=0;while(ticks++<10000&&!simEngine.criteriaResults.every(c=>c.status==='Achieved'))simEngine.tick();const result=simEngine.endRun('evaluate');return {ticks,passed:result.passed,criteria:result.criteria,collisions:simEngine.wallCollisions};});
 assert.equal(run.passed,true,JSON.stringify(run.criteria));assert.equal(run.collisions,0);assert.match(run.criteria.find(c=>c.id==='navigation').observed,/100.0% visited/);
 await page.keyboard.press('Escape');await page.evaluate(()=>openStepModal(6));assert.equal(await page.locator('[data-cleaning-metric="floor"]').count(),0);assert.equal(await page.locator('[data-cleaning-metric="dirt"]').count(),0);await page.screenshot({path:'/private/tmp/peaslab-full-patrol-result.png'});assert.equal(await page.locator('#logicBoardDialog').evaluate(d=>d.open),false);
 const normal=await browser.newPage();await normal.goto(base);await normal.waitForSelector('#beginDesign');assert.equal(await normal.evaluate(async()=>(await import('/js/state.js')).appState.program.length),0);
 const blank=await browser.newPage();await blank.goto(base+'/?preview=logic');await blank.waitForSelector('.blocklySvg');assert.equal(await blank.evaluate(async()=>(await import('/js/state.js')).appState.program.length),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,entry,data,run,normalAndBlankUnchanged:true,errors}));
}finally{await browser.close();}
