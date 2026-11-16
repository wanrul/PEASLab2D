import assert from 'node:assert/strict';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const base=process.env.TEST_URL||'http://localhost:8092';
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1512,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?preview=sensors');await page.waitForSelector('.sensor-editor');
 const state=()=>page.evaluate(async()=>{const s=(await import('/js/state.js')).appState;return{preview:s.localPreview,step:s.currentStep,sensors:[...s.installedSensors],actuators:[...s.installedActuators],observations:s.observedEnvironmentTargets.size,priority:s.stagePurposes[1].TASK_1.priority,config:s.getConfiguration()};});
 let snapshot=await state();assert.equal(snapshot.preview,true);assert.equal(snapshot.step,3);assert.equal(snapshot.observations,0);assert.equal(snapshot.priority,null);assert.deepEqual(snapshot.sensors,[]);assert.equal(snapshot.config.localPreview,true);assert.equal(await page.locator('#sensorAssemblyPreview').isVisible(),true);
 await page.locator('[data-module-id="SENSE_02"]').click();await page.locator('.sensor-editor .mounting-continue').click();assert.equal((await state()).step,4);await page.locator('[data-module-id="ACTUATOR_WHEELS"]').click();await page.locator('#dashboardSteps [data-step="3"]').click();snapshot=await state();assert.deepEqual(snapshot.sensors,['SENSE_02']);assert.deepEqual(snapshot.actuators,['ACTUATOR_WHEELS']);assert.equal(snapshot.observations,0);
 await page.reload();await page.waitForSelector('.sensor-editor');assert.equal((await state()).step,3);
 const normal=await browser.newPage();normal.on('pageerror',e=>errors.push(e.message));await normal.goto(base);await normal.waitForSelector('#beginDesign');
 assert.equal(await normal.evaluate(async()=>{const s=(await import('/js/state.js')).appState;return s.localPreview;}),false);assert.equal(await normal.locator('#dashboardSteps [data-step="3"]').isDisabled(),true);
 await normal.locator('#beginDesign').click();await normal.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await normal.locator('#priorityContinue').click();assert.equal(await normal.locator('#environmentContinue').isDisabled(),true);assert.equal(await normal.locator('#dashboardSteps [data-step="3"]').isDisabled(),true);
 await normal.goto(base+'/?preview=anything');await normal.waitForSelector('#beginDesign');assert.equal(await normal.locator('#dashboardSteps [data-step="3"]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,directSensorsEntry:true,refreshStartsAtSensors:true,canPreviewActuators:true,noFabricatedObservations:true,noPresetAnswers:true,previewConfigurationMarked:true,normalFlowStillGated:true,invalidParameterIgnored:true,errors}));
}finally{await browser.close();}
