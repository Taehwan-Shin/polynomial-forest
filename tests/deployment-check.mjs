import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.argv[2]);
const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://classroom-polynomial-forest.vercel.app/';
const hub = 'https://taehwan-shin.github.io/classroom-hub/';
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({ viewport:{width:1280,height:900} });
const page = await context.newPage(), failures = [];
page.on('pageerror', () => failures.push('browser exception'));
try {
  const response = await page.goto(base, {waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  assert.ok(response.headers()['content-security-policy'].includes('https://ahmcjuuomevfappsrkmh.supabase.co'));
  assert.equal(response.headers()['x-frame-options'],'DENY');
  assert.equal(response.headers()['referrer-policy'],'no-referrer');
  await page.getByRole('button',{name:'로그인',exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'로그인',exact:true}).isEnabled());
  assert.ok((await page.locator('#account-status').innerText()).includes('브라우저에만'));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await page.locator('input[value="quiz"]').check();
  await page.locator('.forest-start').click();
  await page.locator('.forest-quiz[open]').waitFor({timeout:10000});
  await page.locator('.forest-answers button').first().click();
  assert.ok((await page.locator('.forest-feedback').innerText()).includes('정답!'));
  await page.locator('.forest-continue').click();
  await page.locator('.forest-pause').click();
  assert.equal(await page.locator('.forest-pause').innerText(),'계속하기');
  await page.locator('.forest-exit').click();
  await mkdir(path.join(root,'qa'),{recursive:true});
  await page.screenshot({path:path.join(root,'qa/forest-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(root,'qa/forest-mobile.png'),fullPage:true});
  const manifest = await (await context.request.get(base+'BUILD-MANIFEST.json')).json();
  for (const [name,hash] of Object.entries(manifest.files)) {
    if(name==='vercel.json') continue; // Deployment configuration is intentionally not a public asset.
    const result = await context.request.get(base+name); assert.equal(result.status(),200,name);
    assert.equal(createHash('sha256').update(await result.body()).digest('hex'),hash);
    if(name.endsWith('.mjs')) assert.ok(result.headers()['content-type'].includes('javascript'));
  }
  await page.goto(hub,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.tool-card').count(),4);
  assert.equal(await page.getByRole('link',{name:/오늘의 일기/}).getAttribute('href'),'https://classroom-diary-098bae6e.web.app/#/diary');
  // Pages propagation may briefly show the previous polynomial link; caller reruns after a new release.
  assert.equal(await page.getByRole('link',{name:/다항식 숲 탐험/}).getAttribute('href'),base);
  await page.getByRole('link',{name:/교실 타이머/}).click();
  await page.getByRole('heading',{name:/타이머/}).waitFor();
  assert.equal(failures.length,0);
  const config = await (await context.request.get(base+'public-config.json')).json();
  const anon = await context.request.get(config.url+'/rest/v1/forest_attempts?select=stage',{headers:{apikey:config.key}});
  assert.ok([401,403].includes(anon.status()));
  const auth = await (await context.request.get(config.url+'/auth/v1/settings',{headers:{apikey:config.key}})).json();
  console.log(JSON.stringify({publicFilesVerified:Object.keys(manifest.files).length,release:manifest.release,guestQuiz:true,mobile:true,hubLinks:true,timer:true,anonDenied:true,googleProviderEnabled:auth.external?.google===true,browserExceptions:0}));
} finally { await browser.close(); }
