#!/usr/bin/env node
/**
 * CineHunt isolated SQL Server verification.
 * This script NEVER connects to an existing container or SQL Server.
 * It creates a fresh throwaway container, verifies a unique random-port binding,
 * tests schema/seed, optionally runs TypeORM migrations, and removes the container.
 * It intentionally does nothing without --execute.
 */
import { createRequire } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..'); // database/review-candidate -> repo root
const flags = new Set(process.argv.slice(2));
const execute = flags.has('--execute');
const withMigrations = flags.has('--migrations');
const report = { kind: 'CINEHUNT_ISOLATED_SQL_VERIFICATION', at: new Date().toISOString(),
  status: 'NOT_RUN', isolated: true, schema: {}, seed: {}, migrations: 'NOT_RUN' };

function docker(args, { extraEnv = {} } = {}) {
  const p = spawnSync('docker', args, { encoding:'utf8', timeout:30_000,
    env:{...process.env,...extraEnv}, maxBuffer:2_000_000 });
  if (p.error || p.status !== 0) throw Error(`Docker ${args[0]}: ${(p.stderr || p.error?.message || '').slice(-1200)}`);
  return p.stdout.trim();
}
function sha(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function ensure(b,msg){ if(!b) throw Error(msg); }
const pause = ms => new Promise(r=>setTimeout(r,ms));
function tcpReachable(port, timeoutMs = 2500) {
  return new Promise(resolve => {
    const sock = createConnection({ host: '127.0.0.1', port });
    let done = false;
    const finish = ok => {
      if(done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
  });
}
function dockerLogs(name, tail = 60) {
  const p = spawnSync('docker', ['logs', '--tail', String(tail), name], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 2000000,
  });
  return `${p.stdout || ''}\n${p.stderr || ''}`.trim();
}
function dockerState(name) {
  const state = JSON.parse(docker(['inspect','--format', '{{json .State}}', name]));
  return { status: state.Status, exitCode: state.ExitCode,
    oomKilled: state.OOMKilled, error: state.Error || '' };
}
function batches(file) { // Client-side GO separators; don't split on semicolons in procedures.
  return readFileSync(file,'utf8').split(/^\s*GO\s*(?:--[^\r\n]*)?\r?$/gmi)
    .map(s=>s.trim()).filter(Boolean);
}

if (!execute) {
  console.log('DRY RUN: chua tao container, chua ket noi SQL Server.');
  console.log('Chi chay tren Docker test RIENG:');
  console.log('  node database/review-candidate/validate-isolated.mjs --execute');
  console.log('De thu TypeORM migrations sau khi tao schema va seed:');
  console.log('  node database/review-candidate/validate-isolated.mjs --execute --migrations');
  process.exit(0);
}
ensure(flags.size === (withMigrations ? 2 : 1), 'Chi cho phep --execute va --migrations');
const files = ['schema.sql','sample-data.sql'].map(n=>join(here,n));
ensure(files.every(existsSync), 'Chua co du hai file SQL can kiem thu trong cung thu muc');
const manifest = JSON.parse(readFileSync(join(here,'manifest.json'),'utf8'));
for(const [name, hash] of Object.entries(manifest.files)) {
  ensure(sha(join(here,name)) === hash, `SHA-256 mismatch: ${name}. KHONG thuc thi.`);
}
ensure(existsSync(join(root,'backend','package.json')), 'Phai dat bo review trong <repo>/database/review-candidate/');
const req = createRequire(join(root,'backend','package.json'));
let sql;
try { sql = req('mssql'); } catch {
  throw Error('Thieu backend/node_modules/mssql. Chay: cd backend && npm ci (khong thay doi DB)');
}
const context = docker(['context','show']);
console.log(`Docker context: ${context}. Tao container HOAN TOAN MOI, khong dung container/DB dang chay.`);
const existingImages = docker(['ps','--format','{{.Image}}']).split('\n').filter(Boolean);
const localImages = docker(['images','--format','{{.Repository}}:{{.Tag}}']).split('\n').filter(Boolean);
const candidates = [...existingImages,...localImages];
const image = process.env.CINEHUNT_REVIEW_SQL_IMAGE || candidates.find(x => /mssql\/server|azure-sql-edge|sqlserver/i.test(x));
ensure(image, 'Khong thay image SQL Server co san. Cai Docker SQL Server rieng hoac dat CINEHUNT_REVIEW_SQL_IMAGE.');
console.log(`SQL image: ${image}`);
const cname = `cinehunt-review-${process.pid}-${randomBytes(3).toString('hex')}`;
const password = `CineHunt!${randomBytes(28).toString('base64url')}Z9`;
let created = false;
let pool = null;
let port;
function cleanup() {
  if(!created) return;
  try {docker(['rm','-f',cname]); console.log('CLEANUP: Da xoa container SQL review.');}
  catch(e){console.error('WARNING: Khong the xoa container, can chay: docker rm -f '+cname);}
  created=false;
}
process.on('SIGINT',()=>{ cleanup(); process.exit(130); });
process.on('SIGTERM',()=>{ cleanup(); process.exit(143); });

async function startPool(database) {
  return new sql.ConnectionPool({server:'127.0.0.1',port,user:'sa',password,database,
    options:{encrypt:false,trustServerCertificate:true,enableArithAbort:true},
    connectionTimeout:6000,requestTimeout:90_000,pool:{max:1,min:0,idleTimeoutMillis:30_000}}).connect();
}
async function runBatches(file, tag) {
  const all=batches(file);
  for(let i=0;i<all.length;i++) {
    const batch=all[i];
    try { await pool.request().batch(batch); }
    catch(e){const marker=batch.match(/ORIGINAL LINES\s+(\d+-\d+)/i)?.[1]??'preamble';
      throw Error(`${tag} batch ${i+1}/${all.length}, source lines ${marker}: ${String(e.message).slice(0,700)}`);}
    if ((i+1)%15===0 || i+1===all.length)console.log(`${tag}: ${i+1}/${all.length} batches`);
  }
}
async function scalar(query){const r=await pool.request().query(query);return Number(Object.values(r.recordset[0])[0]);}
function needCount(actual,expect,label){ensure(actual===expect,`${label}: expected ${expect}, found ${actual}`);}
function writeReport(){
  const target = join(homedir(),'Desktop',`CineHunt_Isolated_SQL_${Date.now()}.json`);
  try {writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log(`REPORT: ${target}`);}
  catch(e){console.error(`Khong ghi duoc Desktop report: ${e.message}`);}
}
try {
  const dockerEnv={MSSQL_SA_PASSWORD:password}; // Docker CLI gets password via environment, not command-line arguments.
  docker(['run','--detach','--rm','--platform','linux/amd64','--name',cname,'--label','cinehunt.review=ephemeral',
    '--publish','127.0.0.1::1433','--env','ACCEPT_EULA=Y','--env','MSSQL_SA_PASSWORD',image],{extraEnv:dockerEnv});
  created=true;
  const inspect=JSON.parse(docker(['inspect',cname]))[0];
  ensure(inspect.Config?.Labels?.['cinehunt.review']==='ephemeral', 'Container label failed');
  ensure((inspect.Mounts??[]).length===0, 'Container co volume/mount: STOP');
  const pub = inspect.NetworkSettings?.Ports?.['1433/tcp']?.[0];
  ensure(pub?.HostIp==='127.0.0.1', 'Docker expose khong phai 127.0.0.1: STOP');
  const mapped = docker(['port', cname, '1433/tcp']).split('\n').find(line => /^127\.0\.0\.1:\d+$/.test(line.trim()));
  ensure(mapped, 'Docker khong tra ve localhost port cho 1433/tcp');
  port = Number(mapped.trim().split(':').at(-1));
  ensure(Number(pub.HostPort)===port, 'Port trong Docker inspect va docker port khong khop');
  ensure(Number.isInteger(port)&&port>0&&port!==14332, 'Host SQL port invalid or existing testing port');
  console.log(`Ephemeral container ${cname}, SQL localhost:${port}, NO VOLUMES`);
  report.container=cname; report.port=port; report.sqlImage=image;

  // WAIT 1: SQL engine startup. The previous script only tried the TDS driver,
  // so a failed boot and a Docker port-forward failure both appeared as ESOCKET.
  let sqlReady=false;
  const startupAt=Date.now();
  while(Date.now()-startupAt<90_000) {
    const state=dockerState(cname);
    ensure(state.status==='running', `SQL container exit (status=${state.status}, code=${state.exitCode}, oom=${state.oomKilled})`);
    if(dockerLogs(cname, 250).includes('SQL Server is now ready for client connections')) {
      sqlReady=true;
      break;
    }
    await pause(2500);
  }
  ensure(sqlReady, 'SQL Server did not log readiness within 90s');
  console.log('PASS: SQL Server logs report ready.');

  // WAIT 2: Docker Desktop TCP localhost forwarding (separate from SQL readiness).
  let forwarded=false;
  const tcpAt=Date.now();
  while(Date.now()-tcpAt<30_000) {
    if(await tcpReachable(port)) {forwarded=true;break;}
    await pause(1500);
  }
  ensure(forwarded, `Docker localhost port ${port} not reachable within 30s`);
  console.log('PASS: Docker localhost TCP port reachable.');

  // WAIT 3: TDS login. Same SQL options as standalone MSSQL probe that passed.
  const loginAt=Date.now();let lastErr='';
  while(Date.now()-loginAt<60_000) {
    try {pool=await startPool('master');break;}
    catch(e){
      lastErr = `${e.code || 'UNKNOWN'}: ${String(e.message || e).slice(0,240)}`;
      console.log(`SQL login retry: ${String(e.code || 'UNKNOWN').slice(0,40)}`);
      await pause(2500);
    }
  }
  ensure(pool,`SQL login failed after readiness and TCP PASS: ${lastErr}`);
  console.log('PASS: Node mssql connected to isolated master database.');
  let found = await scalar("SELECT COUNT(*) AS n FROM sys.databases WHERE name=N'CineHuntDB'");
  needCount(found,0,'fresh database check');
  await pool.request().query('CREATE DATABASE CineHuntDB');
  await pool.close();pool=null;
  pool=await startPool('CineHuntDB');
  needCount(await scalar('SELECT COUNT(*) AS n FROM sys.tables WHERE is_ms_shipped=0'),0,'empty target check');
  console.log('PASS: fresh SQL instance and empty CineHuntDB verified.');
  await runBatches(files[0],'SCHEMA');
  report.schema.tables=await scalar('SELECT COUNT(*) AS n FROM sys.tables WHERE is_ms_shipped=0');
  report.schema.procedures=await scalar('SELECT COUNT(*) AS n FROM sys.procedures WHERE is_ms_shipped=0');
  report.schema.triggers=await scalar('SELECT COUNT(*) AS n FROM sys.triggers WHERE is_ms_shipped=0');
  report.schema.views=await scalar('SELECT COUNT(*) AS n FROM sys.views WHERE is_ms_shipped=0');
  for (const [kind,expected] of Object.entries({tables:29,procedures:12,triggers:8,views:3}))
    needCount(report.schema[kind],expected,`schema ${kind}`);
  console.log('PASS: schema 29 tables, 12 procedures, 8 triggers, 3 views.');
  await runBatches(files[1],'SEED');
  for(const table of ['roles','cinemas','rooms','seats','movies','showtimes','showtime_seats','users','booking_orders','payments','tickets']) {
    report.seed[table]=await scalar(`SELECT COUNT(*) AS n FROM dbo.${table}`);
  }
  ensure(report.seed.movies>0&&report.seed.cinemas>0&&report.seed.seats>0&&report.seed.showtimes>0,
    'Seed khong tao du phim/rap/ghe/suat');
  for(const table of ['users','booking_orders','payments','tickets'])needCount(report.seed[table],0,`seed must not populate ${table}`);
  console.log('PASS: seed and integrity queries, no predefined users/bookings/payments/tickets.');
  if(withMigrations) {
    await pool.close();pool=null;
    console.log('Migration check: only this isolated SQL container will be used.');
    const p=spawnSync('npm',['run','migration:run'],{cwd:join(root,'backend'),encoding:'utf8',timeout:240_000,
      env:{...process.env,DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_USERNAME:'sa',DB_PASSWORD:password,DB_DATABASE:'CineHuntDB',DB_INSTANCE:'',DB_ENCRYPT:'false',DB_TRUST_SERVER_CERTIFICATE:'true',DB_MIGRATIONS_RUN:'false',NODE_ENV:'test'},maxBuffer:3_000_000});
    if (p.status!==0)throw Error(`MIGRATIONS: exit ${p.status}; ${(p.stderr||p.stdout||'').slice(-1300).replaceAll(password,'[REDACTED]')}`);
    report.migrations='PASS';
    console.log('PASS: TypeORM migrations on disposable SQL only.');
  }
  report.status='PASS';
  console.log('ALL PASS: isolated SQL verified, original CineHuntDB untouched.');
} catch(e) {
  report.status='FAIL';report.error=String(e.message||e).replaceAll(password,'[REDACTED]');
  console.error('FAIL:',report.error);
  if(created) {
    try {
      report.containerState = dockerState(cname);
      console.error('CONTAINER STATE:', JSON.stringify(report.containerState));
      const logTail = dockerLogs(cname, 50).replaceAll(password,'[REDACTED]');
      report.sqlStartupLogTail = logTail.slice(-4500);
      console.error('SQL STARTUP LOG TAIL:\n' + report.sqlStartupLogTail);
    } catch (diagErr) { console.error('Diagnostics unavailable:', String(diagErr)); }
  }
  process.exitCode=1;
} finally {
  try{if(pool)await pool.close();}catch{}
  cleanup();writeReport();
}
