import assert from 'node:assert/strict';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL||'http://localhost:8093')+'/?preview=logic');
 await page.waitForSelector('.logic-board-toggle');await page.locator('.logic-board-toggle').click();
 await page.waitForTimeout(400);
 const drag=await page.evaluate(()=>{
  const w=robotBlockWorkspace;const branch=w.getTopBlocks().find(b=>b.getFieldValue('TASK')==='TASK_1').getInputTargetBlock('BODY');
  const yes=w.newBlock('logic_boolean');yes.initSvg();yes.render();branch.getInput('IF0').connection.connect(yes.outputConnection);
  const action=w.newBlock('ROBOT_STOP');action.initSvg();action.render();action.moveBy(700,50);window.dragActionId=action.id;
  const from=action.previousConnection,to=branch.getInput('DO0').connection,r=action.getSvgRoot().getBoundingClientRect(),m=w.getCanvas().getScreenCTM();
  return{x:r.x+30,y:r.y+15,dx:(to.x-from.x)*m.a,dy:(to.y-from.y)*m.d};
 });
 await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:30});await page.mouse.up();
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>robotBlockWorkspace.getBlockById(dragActionId).previousConnection.isConnected()),true);
 const program=await page.evaluate(async()=>(await import('/js/state.js')).appState.program);
 assert.equal(program.length,1);assert.match(JSON.stringify(program),/stop/i);
 await page.screenshot({path:'/private/tmp/peaslab-learner-drag.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,realMouseDragAndSnap:true,compiled:true,errors}));
}finally{await browser.close();}
