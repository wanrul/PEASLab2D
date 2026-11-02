// Focused real-menu regression: unsupported disable state must not be offered.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('#beginDesign');
 await page.evaluate(()=>{map3d.renderer.setPixelRatio(.2);map3d.onResize();});await page.locator('#beginDesign').click();
 await page.evaluate(async()=>{
  window.state=(await import('/js/state.js')).appState;state.unlockedStep=5;openStepModal(4);
  const w=robotBlockWorkspace,make=type=>{const b=w.newBlock(type);b.initSvg();b.render();return b;};
  window.menuBlocks={behavior:make('PEAS_BEHAVIOR'),control:make('controls_if'),condition:make('COND_09'),action:make('ACT_18')};
  const {behavior,control,condition,action}=menuBlocks,sensor=make('SENSE_02');
  behavior.moveBy(200,50);behavior.getInput('BODY').connection.connect(control.previousConnection);
  control.getInput('IF0').connection.connect(condition.outputConnection);condition.getInput('SENSOR').connection.connect(sensor.outputConnection);control.getInput('DO0').connection.connect(action.previousConnection);
  state.installedSensors.add('SENSE_02');state.installedActuators.add('ACTUATOR_LED');
 });
 await page.waitForTimeout(300);
 const program=await page.evaluate(()=>JSON.stringify(state.program));
 for(const role of ['behavior','control','condition','action']){
  const rect=await page.evaluate(role=>{const r=menuBlocks[role].getSvgRoot().getBoundingClientRect();return{x:r.x+25,y:r.y+12};},role);
  await page.mouse.click(rect.x,rect.y,{button:'right'});await page.waitForSelector('.blocklyContextMenu');
  const menu=await page.locator('.blocklyContextMenu').innerText();
  assert.doesNotMatch(menu,/Disable Block|Enable Block/,`${role}: unsupported enable-state operation must not be offered`);
  assert.match(menu,/Duplicate|Delete/,`${role}: ordinary block menu remains available`);
  await page.evaluate(()=>Blockly.hideChaff());
 }
 assert.equal(await page.evaluate(()=>robotBlockWorkspace.options.disable),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(state.program)),program);
 assert.equal(await page.evaluate(()=>Object.values(menuBlocks).every(b=>b.isEnabled())),true);
 const action=await page.evaluate(()=>{simEngine.tick();return simEngine.activeRuleFired?.action;});
 assert.equal(action,'ACT_18','ordinary visible authored action still executes');assert.deepEqual(errors,[]);
 console.log('PASS: real context menus for behavior/control/condition/action omit Disable/Enable; ordinary menu and authored execution remain intact; no page errors.');
}finally{await browser.close();}
