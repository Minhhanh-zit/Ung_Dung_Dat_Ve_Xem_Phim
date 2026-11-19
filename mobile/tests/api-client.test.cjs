/* global __dirname */
// Uses Node's built-in test runner; no extra npm package or network required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'apiClient.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function moduleWith(fetcher, base = 'http://127.0.0.1:3000') {
  const exports = {};
  const context = { exports, module: {exports}, fetch: fetcher,
    process: {env: {EXPO_PUBLIC_API_URL: base}}, AbortController, setTimeout, clearTimeout,
    Intl, Date, Math, Number, JSON, Error };
  vm.runInNewContext(compiled, context, {filename:'apiClient.ts'});
  return context.module.exports;
}
const reply = (status, data) => ({status, ok:status >= 200 && status < 300, text: async()=> data === null ? '' : JSON.stringify(data)});

test('GET returns JSON data', async()=> {
  const client=moduleWith(async()=>reply(200,{items:[1,2]}));
  assert.equal((await client.api('/movies')).items.length,2);
});
test('POST attaches JSON and bearer token', async()=> {
  let called;
  const client=moduleWith(async(url, opts)=> {called={url,opts};return reply(201,{id:1})});
  await client.api('/bookings',{method:'POST',token:'test-jwt',body:{holdIds:['1']}});
  assert.equal(called.url,'http://127.0.0.1:3000/bookings');
  assert.equal(called.opts.headers.Authorization,'Bearer test-jwt');
  assert.equal(called.opts.headers['Content-Type'],'application/json');
  assert.equal(JSON.parse(called.opts.body).holdIds[0],'1');
});
test('401 retains status but uses friendly message',async()=> {
  const client=moduleWith(async()=>reply(401,{message:'secret internal detail'}));
  await assert.rejects(()=>client.api('/users/me'), e=>e.status===401 && /đăng nhập lại/.test(e.message) && !e.message.includes('secret'));
});
test('login 401 reports incorrect credentials rather than expired session', async()=> {
  const client=moduleWith(async()=>reply(401,{message:'Email hoặc mật khẩu không đúng'}));
  await assert.rejects(()=>client.api('/auth/login',{method:'POST'}), e=>e.status===401 && /mật khẩu/.test(e.message) && !/hết hạn/.test(e.message));
});
test('409 avoids blind resubmit recommendation',async()=> {
  const client=moduleWith(async()=>reply(409,{message:'raw sql deadlock'}));
  await assert.rejects(()=>client.api('/showtime-seats/hold-many'), e=>e.status===409 && /tải lại/.test(e.message));
});
test('unexpected HTML response is rejected',async()=> {
  const client=moduleWith(async()=>({status:200,ok:true,text:async()=>'<html>no</html>'}));
  await assert.rejects(()=>client.api('/movies'), e=>e.status===200 && /dữ liệu không hợp lệ/.test(e.message));
});
test('network failure is user-friendly',async()=> {
  const client=moduleWith(async()=>{throw new Error('ECONNREFUSED:3000')});
  await assert.rejects(()=>client.api('/movies'), e=>e.status===0 && !e.message.includes('3000') && /kết nối/.test(e.message));
});
test('timeout aborts without retrying write',async()=> {
  let calls=0;
  const client=moduleWith((url,opts)=>new Promise((resolve,reject)=>{
    calls++;
    opts.signal.addEventListener('abort',()=>reject(new Error('aborted')), {once:true});
  }));
  await assert.rejects(()=>client.api('/bookings',{method:'POST',timeout:10}),e=>e.status===0 && /quá lâu/.test(e.message));
  assert.equal(calls,1);
});
test('invalid prices are not displayed as 0 VND',()=> {
  const {formatMoney}=moduleWith(async()=>reply(200,{}));
  assert.equal(formatMoney(null),'—');
  assert.equal(formatMoney(undefined),'—');
  assert.equal(formatMoney('abc'),'—');
  assert.equal(formatMoney(Infinity),'—');
  assert.match(formatMoney(123456),/123[.]456/);
});
test('missing API URL fails before calling network',async()=> {
  const client=moduleWith(()=>{throw new Error('should not fetch')},'');
  await assert.rejects(()=>client.api('/movies'),e=>e.status===0 && /cấu hình/.test(e.message));
});


test('expired GET refreshes once and retries with rotated token',async()=>{
  let n=0;
  const client=moduleWith(async(url,opts)=>{
    n++;
    if(n===1)return reply(401,{message:'expired'});
    assert.equal(opts.headers.Authorization,'Bearer new-jwt');
    return reply(200,{ok:true});
  });
  let refreshes=0;
  client.configureSessionRefresh(async old=>{refreshes++;assert.equal(old,'old-jwt');return 'new-jwt'});
  assert.equal((await client.api('/movies',{token:'old-jwt'})).ok,true);
  assert.equal(n,2);assert.equal(refreshes,1);
});
test('expired POST refreshes but never resends a financial write',async()=>{
  let n=0;
  const client=moduleWith(async()=>{n++;return reply(401,{message:'expired'})});
  client.configureSessionRefresh(async()=> 'new-jwt');
  await assert.rejects(()=>client.api('/payments',{method:'POST',token:'old-jwt',body:{}}),e=>e.status===401&&/làm mới/.test(e.message));
  assert.equal(n,1);
});
