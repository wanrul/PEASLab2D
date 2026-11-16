import assert from 'node:assert/strict';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const base=process.env.TEST_URL||'http://localhost:8093',errors=[];
try{
 const page=await browser.newPage({viewport:{width:1512,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?preview=logic');await page.waitForSelector('.blocklySvg');await page.waitForTimeout(1500);assert.match(await page.locator('#stageProgress').innerText(),/Navigation & common behaviors/);
 const initial=await page.evaluate(async()=>{const s=(await import('/js/state.js')).appState,w=robotBlockWorkspace;return {stage:s.currentStage,step:s.currentStep,program:s.program.length,roots:w.getTopBlocks().map(b=>({type:b.type,name:b.getFieldValue('NAME'),task:b.getFieldValue('TASK')})),categories:w.getToolbox().getToolboxItems().map(x=>x.getName()).slice(0,4),state:document.querySelector('.program-status').textContent};});
 assert.equal(initial.program,0);assert.equal(initial.roots.length,4);assert.ok(initial.roots.every(b=>b.type==='LEARNER_BEHAVIOR'));assert.deepEqual(initial.categories,['Sense','Condition','Action','Control']);
 const behavior=await page.evaluate(()=>robotBlockWorkspace.getTopBlocks().find(b=>b.getFieldValue('TASK')==='TASK_1').id);
 // Fill a real starter IF using the new definitions and the actual compiler/runtime.
 await page.evaluate(id=>{const B=Blockly,w=robotBlockWorkspace,b=w.getBlockById(id),branch=b.getInputTargetBlock('BODY');const yes=w.newBlock('logic_boolean');yes.setFieldValue('TRUE','BOOL');yes.initSvg();yes.render();branch.getInput('IF0').connection.connect(yes.outputConnection);const turn=w.newBlock('ROBOT_TURN');turn.setFieldValue('left','DIRECTION');turn.initSvg();turn.render();const angle=w.newBlock('math_number');angle.setFieldValue('90','NUM');angle.initSvg();angle.render();turn.getInput('ANGLE').connection.connect(angle.outputConnection);branch.getInput('DO0').connection.connect(turn.previousConnection);},behavior);
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(async()=>(await import('/js/state.js')).appState.program.length),1);
 const executed=await page.evaluate(()=>{simEngine.stopPreview();simEngine.pause();simEngine.reset();const h=simEngine.world.robot.heading;simEngine.tick();return {before:h,after:simEngine.world.robot.heading,trace:simEngine.lastTrace};});
 assert.ok(Math.abs(executed.after-executed.before+Math.PI/2)<.0001);
 await page.locator('.logic-board-toggle').click();assert.equal(await page.locator('#logicBoardDialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
 const carried=await page.evaluate(async()=>{const s=(await import('/js/state.js')).appState;s.retainRun({stageId:1,runId:999,passed:true});s.continueStage();openStepModal(5);return {stage:s.currentStage,roots:robotBlockWorkspace.getTopBlocks().length,program:s.program.length,workspace:s.blockWorkspace};});
 assert.equal(carried.stage,2);assert.equal(carried.roots,5);assert.equal(carried.program,1);
 await page.evaluate(()=>openStepModal(1));await page.waitForSelector('input[value="speed"]');await page.locator('input[value="speed"]').check();
 assert.equal(await page.evaluate(async()=>(await import('/js/state.js')).appState.stagePurposes[2].TASK_2.priority),'speed');assert.equal(await page.locator('#priorityContinue').isDisabled(),false);
 await page.screenshot({path:'/private/tmp/peaslab-learner-purpose.png'});
 await page.evaluate(()=>openStepModal(5));await page.locator('.logic-board-toggle').click();await page.screenshot({path:'/private/tmp/peaslab-learner-editor.png'});
 const normal=await browser.newPage();normal.on('pageerror',e=>errors.push(e.message));await normal.goto(base);await normal.waitForSelector('#beginDesign');assert.equal(await normal.locator('.overview-missions article').count(),3);assert.match(await normal.locator('.overview-missions').innerText(),/Navigation & common behaviors/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,initial,primitiveTurn:true,stageCarryForward:true,quickGoal:true,normalOverview:true,errors}));
}finally{await browser.close();}
