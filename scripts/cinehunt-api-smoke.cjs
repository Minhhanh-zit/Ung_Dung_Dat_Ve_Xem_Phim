#!/usr/bin/env node
// Read-only integration smoke against a RUNNING dev backend: NEVER writes payments.
const assert=require('node:assert/strict');
const base=(process.env.CINEHUNT_API_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
const checks=[
  ['/health', (x)=>x?.status==='ok'],
  ['/movies?page=1&limit=5',x=>Array.isArray(x?.items)],
  ['/cinemas',Array.isArray],
  ['/concession-combos',Array.isArray],
];
(async()=>{
  let failures=0;
  for(const [route,valid] of checks){
    try{
      const res=await fetch(base+route,{signal:AbortSignal.timeout(10000)});
      const data=await res.json();
      assert.equal(res.status,200,`${route}: HTTP ${res.status}`);
      assert.ok(valid(data),`${route}: invalid response shape`);
      console.log(`PASS API GET ${route}`);
    }catch(e){failures++;console.error(`FAIL API GET ${route}: ${e.message}`)}
  }
  if(failures){console.error(`API_SMOKE_FAIL=${failures}`);process.exitCode=1}
  else console.log('API_SMOKE_PASS=YES');
})();
