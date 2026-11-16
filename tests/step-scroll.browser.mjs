import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import('/Users/jovirosi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.env.ARTIFACT_DIR||'/private/tmp/peaslab-step-scroll-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.TEST_URL||'http://localhost:8092');await page.waitForSelector('#beginDesign');await page.waitForFunction(()=>window.map3d?.modelLoaded,{},{timeout:90000});
 await page.evaluate(()=>{map3d.renderer.setPixelRatio(.5);map3d.onResize();});
 for(const width of [1512,2048,800]){
  await page.setViewportSize({width,height:1000});
  await page.locator('#dashboardSteps').evaluate(el=>el.scrollLeft=0);
  await page.waitForFunction(()=>!document.getElementById('stepScrollRight').hidden&&getComputedStyle(document.getElementById('stepScrollRight')).visibility==='visible');
  const geometry=await page.locator('#dashboardSteps').evaluate(el=>({width:el.clientWidth,max:el.scrollWidth-el.clientWidth,rows:[...el.querySelectorAll('[data-step]')].map(x=>({top:x.getBoundingClientRect().top,radius:parseFloat(getComputedStyle(x).borderTopLeftRadius)}))}));
  assert.equal(geometry.rows.length,7);assert.ok(geometry.max>0);assert.ok(geometry.rows.every(x=>Math.abs(x.top-geometry.rows[0].top)<1&&x.radius===8));
  assert.equal(await page.locator('#stepScrollLeft').isVisible(),false);
  await page.locator('#stepScrollRight').click();await page.waitForFunction(()=>{const n=document.getElementById('dashboardSteps');return n.scrollLeft>=n.scrollWidth-n.clientWidth-1;});
  assert.equal(await page.locator('#stepScrollLeft').isVisible(),true);assert.equal(await page.locator('#stepScrollRight').isVisible(),false);
  await page.screenshot({path:`${out}/last-${width}.png`});
  await page.locator('#stepScrollLeft').click();await page.waitForFunction(()=>document.getElementById('dashboardSteps').scrollLeft<1);
  assert.equal(await page.locator('#stepScrollRight').isVisible(),true);assert.equal(await page.locator('.workstation-menu-title').isVisible(),false);assert.equal(await page.locator('#modalStepBadge').isVisible(),false);const alignment=await page.evaluate(()=>({overview:document.querySelector('#dashboardSteps [data-step="0"]').getBoundingClientRect().left,instructions:document.querySelector('.overview h2').getBoundingClientRect().left,arrow:document.querySelector('#stepScrollRight').getBoundingClientRect().left,nav:document.querySelector('#dashboardSteps').getBoundingClientRect().right}));assert.ok(Math.abs(alignment.overview-alignment.instructions)<1);assert.ok(alignment.arrow-alignment.nav>=12);
 }
 await page.setViewportSize({width:1512,height:1000});await page.keyboard.press('Escape');
 assert.equal(await page.locator('#dashboardMenu .workstation-menu-title').innerText(),'Workstation');
 assert.ok(await page.locator('#dashboardStepMenu').evaluate(el=>el.getBoundingClientRect().width<220));
 assert.equal(await page.locator('#stepScrollRight').isVisible(),false);assert.equal(await page.locator('#stepScrollLeft').isVisible(),false);
 await page.screenshot({path:`${out}/collapsed.png`});
 await page.locator('#dashboardMenu [data-step="0"]').click();assert.equal(await page.locator('#beginDesign').isVisible(),true);
 await page.locator('#beginDesign').click();await page.locator('[data-task-priority="TASK_1"][value="thorough"]').check();await page.locator('#priorityContinue').click();
 assert.equal(await page.locator('#dashboardSteps [aria-current="step"]').getAttribute('data-step'),'2');assert.match(await page.locator('#modalStepBadge').innerText(),/^STAGE 1 OF 3 · STEP 2 OF 6$/);
 await page.locator('[data-language="zh-CN"]').click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');
 assert.match(await page.locator('#stepScrollRight').getAttribute('aria-label'),/最后/);await page.waitForFunction(()=>/阶段 1 \/ 3 · 步骤 2 \/ 6/.test(document.getElementById('modalStepBadge').innerText));assert.equal(await page.locator('#dashboardSteps [data-step]').count(),7);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,widths:[1512,2048,800],oneRow:true,roundedRectangles:true,scrollBothEnds:true,narrowCollapsedMenu:true,reopenAndNavigation:true,bilingual:true,errors,artifacts:out}));
}finally{await browser.close();}
