import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const moduleRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const GAME = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(64);
const HASH = createHash('sha256').update(TOKEN).digest('hex');

function harness({ signedIn = false, role = 'participant', configured = true } = {}) {
  const tables = {
    users: [{id: USER, name: 'Ieva', role, password_hash: bcrypt.hashSync('test-password', 4)}],
    app_sessions: signedIn ? [{token_hash: HASH, user_id: USER, expires_at: new Date(Date.now() + 60000).toISOString()}] : [],
    winner_results: [], all_time_winners: [], seats: [],
  };
  const jar = new Map(signedIn ? [['auksinis-protas-session', TOKEN]] : []);
  const cookieWrites = [];
  const rpcCalls = [];
  const failures = new Set();
  const db = {
    from(table) {
      const filters = [];
      let operation = 'read', payload, mode;
      const builder = {
        select() {return this;}, order() {return this;}, limit() {return this;},
        eq(key, value) {filters.push(row => row[key] === value); return this;},
        gt(key, value) {filters.push(row => row[key] > value); return this;},
        lt(key, value) {filters.push(row => row[key] < value); return this;},
        ilike(key, value) {filters.push(row => row[key].toLowerCase() === value.toLowerCase()); return this;},
        insert(value) {operation = 'insert'; payload = value; return this;},
        upsert(value) {operation = 'upsert'; payload = value; return this;},
        delete() {operation = 'delete'; return this;},
        maybeSingle() {mode = 'single'; return this;}, single() {mode = 'single'; return this;},
        then(resolve, reject) {
          try {
            if (failures.has(table)) return Promise.resolve({data:null, error:{code:'XX000',message:'private backend detail'}}).then(resolve,reject);
            const rows = tables[table] ?? (tables[table] = []);
            let selected = rows.filter(row => filters.every(filter => filter(row)));
            if (operation === 'insert') {
              const row = {id: OTHER, ...payload}; rows.push(row); selected = [row];
            } else if (operation === 'upsert') {
              const existing = rows.find(row => row.id === payload.id);
              if (existing) Object.assign(existing, payload); else rows.push({...payload});
              selected = [payload];
            } else if (operation === 'delete') tables[table] = rows.filter(row => !selected.includes(row));
            return Promise.resolve({data: mode === 'single' ? selected[0] ?? null : selected, error:null}).then(resolve,reject);
          } catch(error) {return Promise.reject(error).then(resolve,reject);}
        },
      };
      return builder;
    },
    async rpc(name, args) {
      rpcCalls.push({name,args});
      return {data: name === 'take_auth_attempt' ? true : {id: OTHER,table_number:2,seat_number:3},error:null};
    },
  };
  const modules = new Map();
  const cookieStore = {
    get(name) {return jar.has(name) ? {value:jar.get(name)} : undefined;},
    set(name, value, options) {jar.set(name,value);cookieWrites.push({name,value,options});},
    delete(name) {jar.delete(name);},
  };
  function load(filename) {
    const file = path.resolve(root,filename);
    if (modules.has(file)) return modules.get(file).exports;
    const mod = {exports:{}};
    modules.set(file,mod);
    const source = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    const localRequire = spec => {
      if (spec === 'server-only') return {};
      if (spec === 'next/headers') return {cookies:async()=>cookieStore,headers:async()=>new Map([['x-vercel-forwarded-for','127.0.0.1']])};
      if (spec === '@supabase/supabase-js') return {createClient:()=>db};
      if (spec.startsWith('@/')) return load(`src/${spec.slice(2)}.ts`);
      if (spec.startsWith('.')) return load(path.relative(root,path.resolve(path.dirname(file),`${spec}.ts`)));
      return moduleRequire(spec);
    };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      process:{env:configured ? {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-secret'} : {NODE_ENV:'production'}},
      TextEncoder, Date, Set, Map, Buffer, console,
    }, {filename:file})(localRequire,mod,mod.exports);
    return mod.exports;
  }
  return {load,tables,jar,cookieWrites,rpcCalls,failures};
}

function teams() {return [1,2,3].map(place=>({place,players:['Ieva'],points:40-place,gameDate:'10 spalio'}));}

test('sessions are opaque, HttpOnly, secure, restored from the database, and revoked on logout', async () => {
  const app = harness();
  const auth = app.load('src/lib/auth.ts');
  const result = await auth.loginUser(' ieva ', 'test-password');
  assert.equal(result.error,null);
  assert.deepEqual(Object.keys(result.data).sort(),['id','name','role']);
  const cookie = app.cookieWrites[0];
  assert.equal(cookie.options.httpOnly,true);
  assert.equal(cookie.options.secure,true);
  assert.equal(cookie.options.sameSite,'lax');
  assert.match(cookie.value,/^[a-f0-9]{64}$/);
  assert.notEqual(app.tables.app_sessions[0].token_hash,cookie.value);
  assert.equal(app.tables.app_sessions[0].token_hash,createHash('sha256').update(cookie.value).digest('hex'));
  assert.equal((await auth.getCurrentUser()).data.id,USER);
  assert.equal((await auth.logoutUser()).error,null);
  assert.equal(app.tables.app_sessions.length,0);
  assert.equal((await auth.getCurrentUser()).data,null);
});

test('forged and expired session tokens confer no rights; roles are read fresh from the database', async () => {
  const app = harness({signedIn:true});
  const auth = app.load('src/lib/auth.ts');
  app.tables.app_sessions[0].expires_at = new Date(Date.now()-60000).toISOString();
  assert.equal((await auth.getCurrentUser()).data,null);
  app.tables.app_sessions[0].expires_at = new Date(Date.now()+60000).toISOString();
  app.jar.set('auksinis-protas-session','b'.repeat(64));
  assert.equal((await auth.getCurrentUser()).data,null);
  app.jar.set('auksinis-protas-session',TOKEN);
  app.tables.users[0].role='admin';
  assert.equal((await auth.getCurrentUser()).data.role,'admin');
  app.tables.users[0].role='participant';
  assert.equal((await auth.getCurrentUser()).data.role,'participant');
});

test('unauthenticated requests cannot mutate reservations or winners or read private history', async () => {
  const app = harness();
  const reservations = app.load('src/lib/supabase/reservations.ts');
  const results = await Promise.all([
    reservations.reserveSeatForUser(GAME), reservations.cancelSeatForUser(GAME), reservations.rejectReservation(OTHER),
    app.load('src/lib/supabase/admin.ts').createGameDate('2026-12-01T19:00:00+02'),
    app.load('src/lib/supabase/winners.ts').saveWinnerResults(teams()),
    app.load('src/lib/supabase/queries.ts').getReservationEvents(),
  ]);
  assert.ok(results.every(result=>result.error));
  assert.equal(app.rpcCalls.length,0);
  assert.equal(app.tables.winner_results.length,0);
});

test('reservation identity comes from the verified session, ignoring a forged caller name', async () => {
  const app = harness({signedIn:true});
  const reservations = app.load('src/lib/supabase/reservations.ts');
  assert.equal((await reservations.reserveSeatForUser(GAME,'Other victim')).error,null);
  assert.equal((await reservations.cancelSeatForUser(GAME,'Other victim')).error,null);
  assert.ok(app.rpcCalls.every(call=>call.args.actor_id===USER));
  assert.ok((await reservations.rejectReservation(OTHER)).error);
  assert.ok((await app.load('src/lib/supabase/winners.ts').saveWinnerResults(teams())).error);
  assert.ok((await app.load('src/lib/supabase/queries.ts').getReservationEvents()).error);
  assert.equal(app.rpcCalls.length,2);
});

test('admin winners are persisted and reread; backend errors cannot be mistaken for saved results', async () => {
  const app = harness({signedIn:true,role:'admin'});
  const winners = app.load('src/lib/supabase/winners.ts');
  assert.equal((await winners.saveWinnerResults(teams())).error,null);
  assert.equal((await winners.getWinners()).data.winners[0].points,39);
  const invalid = teams();invalid[0].points=-1;
  assert.ok((await winners.saveWinnerResults(invalid)).error);
  assert.equal(app.tables.winner_results[0].teams[0].points,39);
  app.failures.add('winner_results');
  const failed = await winners.saveWinnerResults(teams());
  assert.ok(failed.error);
  assert.equal(failed.data,null);
  assert.ok(!failed.error.includes('private backend detail'));
});

test('wrong passwords and unavailable configuration cannot fall back to local administrator access', async () => {
  const app = harness();
  assert.ok((await app.load('src/lib/auth.ts').loginUser('Ieva','wrong-password')).error);
  assert.equal(app.jar.size,0);
  app.tables.users[0].password_hash='!disabled:old-admin';
  assert.ok((await app.load('src/lib/auth.ts').loginUser('Ieva','test-password')).error);
  const missing = harness({configured:false});
  assert.ok((await missing.load('src/lib/auth.ts').loginUser('Ieva','test-password')).error);
  assert.ok((await missing.load('src/lib/auth.ts').registerUser('New user','test-password')).error);
  assert.equal(missing.tables.users.length,1);
});

test('registration normalizes names, hashes passwords, and always creates a participant', async () => {
  const app = harness();
  const result = await app.load('src/lib/auth.ts').registerUser('  New   user  ','test-password','admin');
  assert.equal(result.error,null);
  const stored = app.tables.users.find(user=>user.name==='New user');
  assert.equal(stored.role,'participant');
  assert.notEqual(stored.password_hash,'test-password');
  assert.ok(await bcrypt.compare('test-password',stored.password_hash));
  assert.ok(!('password_hash' in result.data));
});

test('validation rejects bcrypt truncation, duplicate ranks, fractional points, and too many players', () => {
  const {credentialsSchema,winnersSchema}=harness().load('src/lib/validation.ts');
  assert.equal(credentialsSchema.safeParse({name:'Ieva',password:'ą'.repeat(37)}).success,false);
  for (const modify of [t=>t[0].place=2,t=>t[0].points=1.5,t=>t[0].players=Array(5).fill('Name'),t=>t[0].gameDate='Different']) {
    const value=teams();modify(value);assert.equal(winnersSchema.safeParse(value).success,false);
  }
});
