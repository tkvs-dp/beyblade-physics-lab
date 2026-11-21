import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

test('offline browser: model, configurations, playback, mobile, and recovery', {timeout:60000}, async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
    await page.goto(new URL('../index.html',import.meta.url).href);
    await page.waitForSelector('#loading[hidden]',{state:'attached'});
    assert.equal(await page.locator('#viewport canvas').count(),1);
    for(const profile of ['attack','defense','stamina']) {
      await page.selectOption('#profile',profile);
      for(const tip of ['flat','ball','needle'])await page.selectOption('#tip',tip);
    }
    await page.locator('#explode').fill('100');assert.equal(await page.locator('#explode-value').innerText(),'100%');
    await page.click('[data-part="bit"]');assert.match(await page.locator('#part-en').innerText(),/BIT/);
    await page.click('#auto-rotate');assert.equal(await page.locator('#auto-rotate').getAttribute('aria-pressed'),'true');
    await page.click('#auto-rotate');await page.click('#camera-top');await page.click('#camera-home');
    // Test orbit drag and wheel input on the actual canvas.
    const box=await page.locator('#viewport canvas').boundingBox();
    await page.mouse.move(box.x+100,box.y+200);await page.mouse.down();await page.mouse.move(box.x+180,box.y+230,{steps:8});await page.mouse.up();await page.mouse.wheel(0,100);
    await page.click('#battle-mode');await page.selectOption('#profile','attack');await page.locator('#rpm').fill('7200');
    await page.click('[data-player="1"]');await page.selectOption('#profile','defense');await page.selectOption('#direction','1');await page.locator('#rpm').fill('4000');
    await page.click('[data-player="0"]');assert.equal(await page.locator('#rpm').inputValue(),'7200');
    await page.click('#launch');await page.waitForTimeout(700);await page.click('#pause');
    const stopped=await page.locator('#elapsed').innerText();await page.waitForTimeout(300);assert.equal(await page.locator('#elapsed').innerText(),stopped);assert.match(await page.locator('#result').innerText(),/暫停/);
    await page.selectOption('#speed','0.1');await page.click('#pause');await page.waitForTimeout(700);await page.click('#pause');
    const slowed=await page.locator('#elapsed').innerText();assert.ok(parseFloat(slowed)>parseFloat(stopped));assert.ok(parseFloat(slowed)-parseFloat(stopped)<.2);
    await page.click('#vectors');assert.equal(await page.locator('#vectors').getAttribute('aria-pressed'),'true');
    await page.click('#pause');await page.click('#inspect-mode');await page.click('#battle-mode');assert.match(await page.locator('#result').innerText(),/暫停/);
    await page.click('#reset');assert.equal(await page.locator('#rpm-a').innerText(),'0');assert.equal(await page.locator('#elapsed').innerText(),'0.00 s');assert.equal(await page.locator('#pause').isDisabled(),true);
    for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});for(const id of ['inspect-mode','battle-mode']){await page.click('#'+id);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    // Verify actionable WebGL context-loss state.
    await page.evaluate(()=>{const canvas=document.querySelector('#viewport canvas');canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();});
    await page.waitForSelector('#loading:not([hidden])');assert.match(await page.locator('#loading').innerText(),/重新整理/);
  }finally{await browser.close();}
});
