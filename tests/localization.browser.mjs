// Run separately with a local server and PLAYWRIGHT_MODULE pointing to Playwright.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const artifacts=process.env.ARTIFACT_DIR || '/tmp/peaslab-localization';
await mkdir(artifacts,{recursive:true});
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
const errors=[]; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8092');
  await page.waitForFunction(() => window.simEngine && window.openStepModal);
  await page.evaluate(()=>{window.map3d?.renderer.setPixelRatio(.4);window.map3d?.onResize();});
  console.log('Loaded app; checking keyboard, defaults and drafts');
  assert.equal(await page.locator('[data-language="zh-CN"]').count(),1,'Chinese switch exists');
  await page.locator('[data-language="zh-CN"]').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#stepModalOverlay').evaluate(n=>n.style.display),'flex');
  assert.equal(await page.evaluate(()=>window.currentViewMode),'fps');
  await page.locator('[data-language="en"]').click();
  await page.locator('#beginDesign').click();
  await page.evaluate(async () => {
    window.testState=(await import('/js/state.js')).appState;
    window.testLog=(await import('/js/logging/session-log.js')).sessionLogger;
    window.openStepModal(1);
  });
  const snapshot=()=>page.evaluate(()=>JSON.stringify({purposes:testState.stagePurposes,observedEnvironment:[...testState.observedEnvironment],observedEnvironmentTargets:[...testState.observedEnvironmentTargets],rules:testState.rules,revision:testState.rulesRevision,events:testState.eventOrder,history:testState.runHistory,logs:testState.observationLogs}));
  const toggle=async lang=>{ await page.locator(`[data-language="${lang}"]`).click(); await page.waitForFunction(lang=>document.documentElement.lang===lang,lang); };
  const before=await snapshot();
  assert.equal(await page.locator('[data-task-purpose]').count(),0,'Purpose has no editable task-description fields');
  const factoryDescription=await page.locator('[data-task-description="TASK_1"]').innerText();
  await page.evaluate(()=>window.purposeNode=document.querySelector('[data-task-description="TASK_1"]'));
  assert.equal(await page.evaluate(()=>purposeNode.tagName),'P');
  await toggle('zh-CN');
  assert.match(await page.locator('[data-task-description="TASK_1"]').innerText(),/[\u3400-\u9fff]/);
  assert.equal(await snapshot(),before);
  await toggle('en');
  assert.equal(await page.locator('[data-task-description="TASK_1"]').innerText(),factoryDescription);
  assert.equal(await snapshot(),before);
  assert.equal(await page.evaluate(()=>purposeNode===document.querySelector('[data-task-description="TASK_1"]')),true);
  // Preserve a pre-existing literal purpose through the state API; the UI is read-only.
  await page.evaluate(()=>{testState.setTaskPurpose('TASK_1','Continue');window.openStepModal(1);});
  const literalBefore=await snapshot();
  await toggle('zh-CN');
  assert.equal(await page.locator('[data-task-description="TASK_1"]').innerText(),'Continue');
  assert.equal(await snapshot(),literalBefore);
  await toggle('en');
  assert.equal(await page.locator('[data-task-description="TASK_1"]').innerText(),'Continue');
  assert.equal(await snapshot(),literalBefore);
  // Mounting selection, element identity and independent library scroll survive.
  await page.evaluate(async()=>{testState.setTaskPriority('TASK_1','thorough');window.openStepModal(2);const {observeAllEnvironmentForTest}=await import('/tests/fixtures/structured-solution.mjs');observeAllEnvironmentForTest(testState,simEngine.world);window.openStepModal(3);});
  await page.locator('.module-card').first().click();
  await page.evaluate(()=>{window.selectedCard=document.querySelector('.module-card[aria-pressed="true"]');window.library=document.querySelector('.mounting-library');library.scrollTop=200;window.savedScroll=library.scrollTop;});
  await toggle('zh-CN');
  assert.deepEqual(await page.evaluate(()=>[selectedCard===document.querySelector('.module-card[aria-pressed="true"]'),library===document.querySelector('.mounting-library'),library.scrollTop===savedScroll]),[true,true,true]);
  assert.match(await page.locator('.module-card span:last-child').first().innerText(),/[\u3400-\u9fff]/);
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-sensors.png')});
  await toggle('en');
  await page.evaluate(()=>{testState.toggleSensor('SENSE_05');testState.toggleActuator('ACTUATOR_VACUUM');testState.unlockedStep=5;window.openStepModal(5);});
  await page.evaluate(()=>{window.savedWorkspace=robotBlockWorkspace;window.savedBlock=robotBlockWorkspace.newBlock('PEAS_BEHAVIOR');savedBlock.initSvg();savedBlock.render();savedBlock.moveBy(250,90);window.workspacePosition={x:robotBlockWorkspace.scrollX,y:robotBlockWorkspace.scrollY,scale:robotBlockWorkspace.scale};});
  await toggle('zh-CN');
  assert.equal(await page.evaluate(()=>savedWorkspace===robotBlockWorkspace&&savedBlock===robotBlockWorkspace.getBlockById(savedBlock.id)),true);
  assert.deepEqual(await page.evaluate(()=>({x:robotBlockWorkspace.scrollX,y:robotBlockWorkspace.scrollY,scale:robotBlockWorkspace.scale})),await page.evaluate(()=>workspacePosition));
  assert.match(await page.locator('.structured-editor header').innerText(),/[\u3400-\u9fff]/);
  console.log('Mounting and rule selection preserved; checking running simulation');
  // Real run remains active with the same run ID and advancing clock.
  await page.evaluate(()=>{testState.setProgram([{id:'browser-behavior',type:'behavior',taskId:'TASK_1',priority:1,body:[{id:'browser-action',type:'action',command:'ACT_09'}]}]);testState.unlockedStep=6;window.openStepModal(6);window.simEngine.start();});
  await page.waitForTimeout(250);
  const runBefore=await page.evaluate(()=>({id:simEngine.runId,tick:simEngine.tickCount,starts:testLog.events?.filter(e=>e.event==='RUN_STARTED').length,ends:testState.runHistory.length}));
  await toggle('en'); await toggle('zh-CN'); await page.waitForTimeout(250);
  const runAfter=await page.evaluate(()=>({id:simEngine.runId,tick:simEngine.tickCount,running:testState.simRunning,starts:testLog.events?.filter(e=>e.event==='RUN_STARTED').length,ends:testState.runHistory.length}));
  assert.equal(runAfter.id,runBefore.id); assert.equal(runAfter.running,true); assert.ok(runAfter.tick>runBefore.tick); assert.equal(runAfter.starts,runBefore.starts); assert.equal(runAfter.ends,runBefore.ends);
  assert.match(await page.locator('#criterionResults').innerText(),/灰尘网格已清洁/);
  await page.locator('#observationNote').fill('Run');
  await page.locator('[data-stamp="?"]').click();
  await toggle('en'); await toggle('zh-CN');
  assert.equal(await page.locator('.single-stamp span').last().innerText(),'Run');
  await page.locator('#stageReflection').fill('Give your robot senses');
  await toggle('en'); await toggle('zh-CN');
  assert.equal(await page.locator('#stageReflection').inputValue(),'Give your robot senses');
  await page.evaluate(()=>simEngine.pause());
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-live-run.png')});
  // The switch is reachable over POV and existing scene identities are stable.
  await page.waitForFunction(()=>map3d.modelLoaded);
  await page.evaluate(()=>{window.robotIdentity=map3d.robotGroup;window.modelIdentity=map3d.apartmentModel;window.enterRobotPov();});
  assert.equal(await page.evaluate(()=>testState.isRobotPovActive),true);
  await toggle('en'); await toggle('zh-CN');
  assert.equal(await page.evaluate(()=>robotIdentity===map3d.robotGroup && modelIdentity===map3d.apartmentModel && testState.isRobotPovActive),true);
  assert.match(await page.locator('.close-pov-btn').innerText(),/退出 Robot POV/);
  await page.keyboard.press('Escape');
  console.log('Live feedback and POV preserved; checking all three stages');
  // Every cumulative stage, all criteria, defaults and both libraries render Chinese.
  await page.evaluate(async()=>{
    const {PILOT_STAGES}=await import('/js/pilot-config.js');
    window.testStages=PILOT_STAGES;
  });
  for(let stage=1;stage<=3;stage++) {
    await page.evaluate(stage=>{testState.currentStage=stage;testState.selectedTasks=[...testStages[stage-1].taskIds];testState.stagePurposes[stage]=testState.createStagePurposes(stage);testState.stageResults[stage]={passingRunId:null,closingText:''};testState.unlockedStep=6;testState.currentStep=1;testState.notify('stageChanged',{stageId:stage});window.openStepModal();},stage);
    assert.equal(await page.evaluate(()=>testState.currentStep),1);
    assert.equal(await page.evaluate(()=>testState.currentStage),stage);
    assert.match(await page.locator('#stageProgress').innerText(),new RegExp(`任务 ${stage}`));
    assert.equal(await page.locator('#stepModalOverlay').isVisible(),true);
    assert.equal(await page.locator('[data-task-description]').count(),stage);
    assert.equal(await page.locator('[data-task-purpose]').count(),0);
    for(const description of await page.locator('[data-task-description]').all()) {
      assert.equal(await description.evaluate(n=>n.tagName),'P');
      assert.match(await description.innerText(),/[\u3400-\u9fff]/);
    }
    assert.doesNotMatch(await page.locator('.stage-purposes').innerText(),/Success criterion|Clean at least|Correctly sort|Stop in every|Below \d+% battery/);
  }
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-stage-three.png')});
  await page.evaluate(()=>window.openStepModal(4));
  assert.match(await page.locator('.module-card span:last-child').first().innerText(),/[\u3400-\u9fff]/);
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-actuators.png')});
  await page.evaluate(()=>{window.openStepModal(6);simEngine.reset();simEngine.start();});
  await page.waitForTimeout(350);
  await page.evaluate(()=>simEngine.endRun('evaluate'));
  await page.waitForSelector('#reflectionPanel');
  const rects=await page.evaluate(()=>Object.fromEntries(['simFloatingHud','reflectionPanel'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,right:r.right,bottom:r.bottom}];})));
  console.log('Stage 3 failed-run layout:',JSON.stringify(rects));
  const overlap=(a,b)=>a.x<b.right && a.right>b.x && a.y<b.bottom && a.bottom>b.y;
  assert.equal(overlap(rects.simFloatingHud,rects.reflectionPanel),false,'reflection panel does not overlap live six-criterion HUD');
  assert.doesNotMatch(await page.locator('#hudCriteria').innerText(),/dirt cells cleaned|Partially achieved|Not achieved|moving encounters/);
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-stage-three-failure.png')});
  await page.setViewportSize({width:800,height:900});
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-narrow.png')});
  const narrow=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
    return{header:rect('.app-header'),stage:rect('#stageProgress'),hud:rect('#simFloatingHud'),panel:rect('.testing-layout .step-modal-dialog'),reflection:rect('#reflectionPanel')};
  });
  assert.ok(narrow.stage.y>=narrow.header.y && narrow.stage.bottom<=narrow.header.bottom);
  assert.ok(narrow.hud.right<narrow.panel.x);
  assert.ok(narrow.reflection.bottom<narrow.hud.y);
  const switchBox=await page.locator('.language-switch').boundingBox();assert.ok(switchBox.x>=0 && switchBox.y+switchBox.height<=900);
  // Persistence includes reload. A separate context blocks both storage operations.
  // Closing reflection and final summary keep user phrases literal.
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{testState.stagePurposes[1].TASK_1.purpose='Continue';window.openStepModal(6);});
  await page.locator('#finishSession').click();
  await page.locator('#closingReflection').fill('Give your robot senses');
  await toggle('en'); await toggle('zh-CN');
  assert.equal(await page.locator('#closingReflection').inputValue(),'Give your robot senses');
  await page.locator('#showSummary').click();
  assert.equal(await page.locator('.stage-summary').count(),3);
  assert.match(await page.locator('.stage-summary').first().innerText(),/Continue/);
  assert.match(await page.locator('.stage-summary').last().innerText(),/Give your robot senses/);
  const summaryBefore=await snapshot();
  await toggle('en'); await toggle('zh-CN');
  assert.equal(await snapshot(),summaryBefore);
  await page.screenshot({animations:'disabled',path:join(artifacts,'zh-final-summary.png')});
  console.log('Failure layout, final summary, narrow view verified; checking storage');
  await page.reload(); await page.waitForFunction(()=>window.simEngine);
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  const blocked=await browser.newPage();
  await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
  await blocked.goto(process.env.TEST_URL || 'http://127.0.0.1:8092');await blocked.waitForFunction(()=>window.simEngine);
  assert.equal(await blocked.locator('html').getAttribute('lang'),'en');
  await blocked.locator('[data-language="zh-CN"]').click();assert.equal(await blocked.locator('html').getAttribute('lang'),'zh-CN');
  await blocked.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: localization browser regressions, three stages, live run, drafts, selections, POV, persistence and blocked storage.');
} finally { await browser.close(); }
