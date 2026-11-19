/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','src','services','authSession.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(fetcher){
  const store={session:{token:'old-access',user:{userId:1}},refresh:'old-refresh'};
  const persisted={loadSession:async()=>store.session,saveSession:async v=>{store.session=v},loadRefreshToken:async()=>store.refresh,saveRefreshToken:async v=>{store.refresh=v}};
  const exports={};
  const requireMock=name=>{
    if(name==='react-native')return {Platform:{OS:'ios'}};
    if(name==='../store/persist')return persisted;
    if(name==='./apiClient')return {ApiError:class ApiError extends Error{constructor(message,status){super(message);this.status=status}}};
    throw Error(`Unexpected require ${name}`);
  };
  const context={exports,module:{exports},require:requireMock,process:{env:{EXPO_PUBLIC_API_URL:'http://127.0.0.1:3000'}},fetch:fetcher,AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(compiled,context,{filename:'authSession.ts'});
  return {auth:context.module.exports,store};
}
test('native refresh rotates refresh and access tokens',async()=>{
  let sent;
  const {auth,store}=harness(async(url,opts)=>{sent={url,opts};return {status:200,ok:true,json:async()=>({accessToken:'new-access',refreshToken:'new-refresh'})}});
  let notified;
  auth.subscribeNativeTokenChanges(token=>{notified=token});
  assert.equal(await auth.refreshNativeAccessToken('old-access'),'new-access');
  assert.equal(store.refresh,'new-refresh');assert.equal(store.session.token,'new-access');
  assert.equal(notified,'new-access');
  assert.equal(sent.opts.headers.Authorization,'Bearer old-refresh');
  assert.match(sent.url,/\/auth\/native\/refresh$/);
});
test('native refresh invalid token clears local session',async()=>{
  const {auth,store}=harness(async()=>({status:401,ok:false}));
  let notified='not-set';auth.subscribeNativeTokenChanges(v=>{notified=v});
  assert.equal(await auth.refreshNativeAccessToken('old-access'),null);
  assert.equal(store.refresh,null);assert.equal(store.session,null);assert.equal(notified,null);
});
test('native refresh does not overwrite a newer login',async()=>{
  const {auth,store}=harness(async()=>{throw Error('should not refresh')});
  assert.equal(await auth.refreshNativeAccessToken('not-current'), 'old-access');
  assert.equal(store.refresh,'old-refresh');
});
