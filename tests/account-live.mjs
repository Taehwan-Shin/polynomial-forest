import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../public-config.json',import.meta.url),'utf8'));
const url=config.url+'/functions/v1/forest-account';
const tests=[];
const call=(body,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const password=randomBytes(24).toString('base64url');
const cleanup=[];
try {
 const users=[];
 for(let i=0;i<2;i++) {
  const username='qa_'+randomBytes(8).toString('hex');
  const r=await call({action:'signup',username,password});
  const session=await r.json(); if(r.status!==200) console.log(JSON.stringify({status:r.status,code:session.code,error:typeof session.error==='string'?session.error:undefined,message:session.message})); assert.equal(r.status,200,'signup status'); assert.equal(!!session.access_token,true);
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
  const digest=createHash('sha256').update('forest-account-v1:'+username).digest('hex');
  cleanup.push({id:claims.sub,email:digest+'@accounts.invalid'}); users.push({username,session,id:claims.sub});
 }
 tests.push('two real accounts');
 const api=(user,path,method='GET',body)=>fetch(config.url+'/rest/v1/'+path,{method,headers:{apikey:config.key,Authorization:'Bearer '+user.session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const attempt={user_id:users[0].id,attempt_id:randomUUID(),stage:'operations',character:'squirrel',mode:'quiz',score:600,correct_count:6,hits:0,acorns:0,answers:[0,1,2,3,0,1]};
 assert.equal((await api(users[0],'forest_attempts','POST',attempt)).ok,true);tests.push('own record saved');
 const read=await api(users[0],'forest_attempts?select=score');assert.equal((await read.json()).length,1);
 const other=await api(users[1],'forest_attempts?select=score');assert.equal((await other.json()).length,0);tests.push('other account cannot read');
 const attack=await api(users[1],'forest_attempts','POST',{...attempt,attempt_id:randomUUID()});assert.equal(attack.ok,false);tests.push('other account cannot write');
 const summary=await api(users[0],'forest_summary?select=record');assert.equal((await summary.json())[0].record.best.operations,600);tests.push('summary loads');
 assert.equal((await call({action:'login',username:users[0].username,password})).status,200);tests.push('password login');
 assert.equal((await call({action:'login',username:users[0].username,password:randomBytes(24).toString('hex')})).status,400);tests.push('wrong password rejected');
 assert.equal((await call({action:'reset',username:users[0].username,password})).status,403);tests.push('non-admin reset blocked');
 assert.equal((await call({action:'login',username:users[0].username,password},{Origin:'https://untrusted.example'})).status,403);tests.push('foreign origin blocked');
 assert.equal((await call({action:'signup',username:'bad!',password})).status,400);tests.push('input validation');
 const r=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.key}});const settings=await r.json();assert.equal(settings.disable_signup,true);tests.push('direct signup disabled');
 const {chromium}=await import(process.argv[2]);const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();let errors=0;page.on('pageerror',()=>errors++);
  await page.goto('https://classroom-polynomial-forest.vercel.app/',{waitUntil:'networkidle'});
  await page.locator('#username').fill(users[0].username);await page.locator('#password').fill(password);await page.locator('#sign-in').click();
  await page.locator('#logout').waitFor({state:'visible'});
  await page.getByText(/내 계정 기록/).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);tests.push('browser login and no persistent session');
  await page.locator('#logout').click();await page.locator('#account-form').waitFor({state:'visible'});
  await page.locator('#forgot').click();assert.equal((await page.locator('#account-status').innerText()).includes('담당 선생님에게 직접 문의'),true);
  assert.equal(errors,0);tests.push('logout and teacher help');
 } finally {await browser.close();}
 console.log(JSON.stringify({passed:tests.length,checks:tests}));
} finally {
 // Only disposable test account identifiers; never tokens, passwords or real profiles.
 await writeFile(new URL('../qa/test-account-cleanup.json',import.meta.url),JSON.stringify(cleanup));
}
