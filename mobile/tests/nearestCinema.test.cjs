/* global __dirname: readonly */
// Runs against real production TypeScript, not a duplicated algorithm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourceFile = path.join(__dirname, '../src/cinehunt/cinemaNearest.ts');
const output = ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const unit = new Module(sourceFile, module);
unit.filename = sourceFile;
unit.paths = module.paths;
unit._compile(output,sourceFile);
const geo = unit.exports;
const cinemas = [
  {cinemaId:1,cinemaName:'CineHunt Cầu Giấy',address:'11 Duy Tân',city:'Hà Nội',latitude:21.0309,longitude:105.7828,status:'ACTIVE'},
  {cinemaId:2,cinemaName:'CineHunt Hà Đông',address:'2 Trần Phú',city:'Hà Nội',latitude:20.9801,longitude:105.7909,status:'ACTIVE'},
  {cinemaId:3,cinemaName:'CineHunt Thanh Xuân',address:'2 Lê Văn Thiêm',city:'Hà Nội',latitude:21.0022,longitude:105.80277,status:'ACTIVE'},
  {cinemaId:4,cinemaName:'CineHunt Aeon Long Biên',address:'27 Cổ Linh',city:'Hà Nội',latitude:21.0466,longitude:105.8935,status:'ACTIVE'},
];
test('Chỉ lấy đúng ba rạp của CineHunt demo',()=>{
  assert.deepEqual(geo.filterCoreCinemas(cinemas).map(x=>x.cinemaName),[
    'CineHunt Cầu Giấy','CineHunt Hà Đông','CineHunt Thanh Xuân'
  ]);
});
test('Xếp GPS theo đường thẳng; không giả số km đi ô tô',()=>{
  const r=geo.rankNearbyCinemas(cinemas,{latitude:21.002,longitude:105.802});
  assert.equal(r.length,3);
  assert.equal(r[0].cinemaName,'CineHunt Thanh Xuân');
  assert.ok(r[0].straightLineKm<r[1].straightLineKm);
  assert.equal(r[0].durationMinutes,undefined);
});
test('Google Maps liên kết tuyến ô tô đúng vị trí xuất phát',()=>{
  const r=geo.rankNearbyCinemas(cinemas,{latitude:21.002,longitude:105.802});
  assert.ok(r[0].mapsUrl.includes('travelmode=driving'));
  assert.ok(r[0].mapsUrl.includes('origin='));
  assert.ok(decodeURIComponent(r[0].mapsUrl).includes('2 Lê Văn Thiêm'));
});
test('Hỏi gần Tân Mai không giả GPS của người dùng',()=>{
  const intent=geo.nearestIntent('Tìm rạp gần Tân Mai cho tôi');
  assert.equal(intent.kind,'named');
  const result=geo.cinemasFromNamedPlace(cinemas,intent.origin);
  assert.equal(result.length,3);
  assert.ok(result.every(c=>c.straightLineKm===null));
  assert.ok(result.every(c=>decodeURIComponent(c.mapsUrl).includes('Tân Mai')));
});
test('Hỏi rạp gần tôi không đòi Gemini API',()=>{
  assert.equal(geo.nearestIntent('Tìm rạp gần nhất cho tôi').kind,'gps');
  assert.equal(geo.nearestIntent('Hôm nay có phim nào hay?'),null);
});
test('GPS sai và tọa độ thiếu không tạo khoảng cách bịa',()=>{
  assert.deepEqual(geo.rankNearbyCinemas(cinemas,{latitude:200,longitude:105.8}),[]);
  const rows=geo.rankNearbyCinemas([{...cinemas[0],latitude:null}],{latitude:21,longitude:105.8});
  assert.equal(rows[0].straightLineKm,null);
});
