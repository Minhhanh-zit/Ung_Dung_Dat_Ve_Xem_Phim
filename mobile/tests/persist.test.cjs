/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source=fs.readFileSync(path.join(__dirname,'..','src','store','persist.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function storage(){
  const values=new Map();
  const secure={getItemAsync:async key=>values.get(key)??null,setItemAsync:async(key,value)=>{values.set(key,value)},deleteItemAsync:async key=>{values.delete(key)}};
  const exports={};
  const mockRequire=(name)=>{
    if(name==='react-native')return {Platform:{OS:'ios'}};
    if(name==='expo-secure-store')return secure;
    throw new Error(`Unexpected module ${name}`);
  };
  const context={exports,module:{exports},require:mockRequire,JSON,Number,Set,Array};
  vm.runInNewContext(compiled,context,{filename:'persist.ts'});
  return {api:context.module.exports,values};
}
test('sessions stored in SecureStore using a versioned payload',async()=>{
  const {api,values}=storage();
  const session={token:'jwt',user:{userId:2}};
  await api.saveSession(session);
  assert.equal(JSON.parse(values.get('cinehunt.session')).version,1);
  assert.equal((await api.loadSession()).token,'jwt');
  await api.saveSession(null);
  assert.equal(await api.loadSession(),null);
});
test('legacy sessions are readable',async()=>{
  const {api,values}=storage();
  values.set('cinehunt.session',JSON.stringify({token:'old',user:{userId:1}}));
  assert.equal((await api.loadSession()).token,'old');
});
test('corrupted and future-version sessions fail closed',async()=>{
  const {api,values}=storage();
  values.set('cinehunt.session','{invalid');
  assert.equal(await api.loadSession(),null);
  values.set('cinehunt.session',JSON.stringify({version:999,data:{token:'secret',user:{}}}));
  assert.equal(await api.loadSession(),null);
});
test('favorites have versioning, validation and legacy compatibility',async()=>{
  const {api,values}=storage();
  values.set('cinehunt.favorites',JSON.stringify([3,3,-4,'bad',1]));
  assert.deepEqual(Array.from(await api.loadFavorites()),[3,1]);
  await api.saveFavorites([1,2,2,-5]);
  assert.equal(JSON.parse(values.get('cinehunt.favorites')).version,1);
  assert.deepEqual(Array.from(await api.loadFavorites()),[1,2]);
});
test('theme retains old light/dark representation',async()=>{
  const {api}=storage();
  await api.saveTheme('dark');
  assert.equal(await api.loadTheme(),'dark');
});


test('native refresh token uses SecureStore and can be cleared',async()=>{
  const {api,values}=storage();
  await api.saveRefreshToken('sensitive-refresh');
  assert.equal(values.get('cinehunt.refresh'),'sensitive-refresh');
  assert.equal(await api.loadRefreshToken(),'sensitive-refresh');
  await api.saveRefreshToken(null);
  assert.equal(await api.loadRefreshToken(),null);
});
