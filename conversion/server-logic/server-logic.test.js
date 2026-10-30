// Run with: node --test conversion/server-logic/server-logic.test.js
//
// Runs the generated server logic file (nb-permit-rules/nb-permit-rules.js)
// in a plain node:vm context, the way the platform runs a script: top-level
// functions get() and post(), a global `Server`, no require/module.
//
// Everything under "STUB" below is a stand-in for the Power Pages runtime,
// written from the Microsoft Learn descriptions. It is NOT the real platform.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { build, sharedRegions, dedent, outPath, rulesPath } = require('./build.js');
const rules = require('../js/rules.js');

const generated = fs.readFileSync(outPath, 'utf8');

// ---- STUB: Power Pages `Server` object ---------------------------------
// Shapes taken from https://learn.microsoft.com/en-us/power-pages/configure/server-objects
// and the CRUD sample in .../server-logic-operations (string envelope with a
// JSON string Body). Server.User.contactid is an assumption (Learn only shows
// fullname). Record contents are test data.
function makeServerStub(opts) {
  const o = opts || {};
  const log = [];
  const updates = [];
  const envelope = (body) => JSON.stringify({
    StatusCode: 200, Body: JSON.stringify(body), IsSuccessStatusCode: true,
    ReasonPhrase: 'OK', ServerError: false, ServerErrorMessage: null
  });
  const Server = {
    Logger: {
      Log: (m) => log.push(['log', m]),
      Warn: (m) => log.push(['warn', m]),
      Error: (m) => log.push(['error', m])
    },
    Context: {
      HttpMethod: o.method || 'POST',
      QueryParameters: o.query || {},
      Body: o.body === undefined ? '' : o.body,
      Headers: {}
    },
    User: o.user === undefined ? null : o.user,
    Connector: {
      Dataverse: {
        RetrieveRecord: (entitySet, id, options) => {
          if (entitySet === 'contacts') {
            return envelope({
              contactid: id,
              powerpagecomponent_mspp_webrole_contact: (o.webRoles || []).map((name) => ({ name }))
            });
          }
          if (entitySet === 'nb_permitapplications') {
            return envelope(Object.assign({ nb_permitapplicationid: id }, o.application || {}));
          }
          throw new Error('stub: unexpected RetrieveRecord ' + entitySet + ' ' + options);
        },
        UpdateRecord: (entitySet, id, payload) => {
          updates.push({ entitySet, id, payload: JSON.parse(payload) });
          return JSON.stringify({ StatusCode: 204, Body: '', IsSuccessStatusCode: true });
        }
      }
    }
  };
  return { Server, log, updates };
}
// ---- end STUB ----------------------------------------------------------

// Load the generated file into a fresh context and call one handler.
function invoke(handler, opts) {
  const stub = makeServerStub(opts);
  const context = vm.createContext({ Server: stub.Server });
  vm.runInContext(generated, context, { filename: 'nb-permit-rules.js' });
  const raw = context[handler]();
  assert.equal(typeof raw, 'string', handler + '() must return a string');
  return { result: JSON.parse(raw), stub };
}

function post(operation, input, opts) {
  return invoke('post', Object.assign({ body: JSON.stringify({ operation, input }) }, opts));
}

const roleToWebRole = { Applicant: 'Northbank Applicant', Reviewer: 'Northbank Reviewer', Admin: 'Northbank Admin' };

// Map one shared vector to a server logic request and pick the answer.
function runVectorOnServer(c) {
  const i = c.input;
  switch (c.rule) {
    case 'E1': case 'E2': case 'E3':
      return post('eligibility', i).result[c.rule];
    case 'F1': return post('fee', i).result.baseFee;
    case 'F2': return post('fee', i).result.surcharge;
    case 'F3': case 'F4': case 'F5': return post('fee', i).result.fee;
    case 'S1': {
      // The role comes from the (stubbed) signed-in user, not from the body.
      const webRoles = roleToWebRole[i.role] ? [roleToWebRole[i.role]] : [];
      return post('transition', { from: i.from, to: i.to },
        { user: { contactid: 'c-1', fullname: 'Test User' }, webRoles }).result.allowed;
    }
    default: throw new Error('not a server logic rule: ' + c.rule);
  }
}

// ---- 1. same code as rules.js ------------------------------------------

test('generated file is up to date with rules.js and handlers.js', () => {
  assert.equal(generated, build());
});

test('every <shared> region of rules.js appears verbatim (dedented) in the server logic file', () => {
  const regions = sharedRegions(fs.readFileSync(rulesPath, 'utf8'));
  assert.ok(regions.length >= 2);
  for (const r of regions) { assert.ok(generated.includes(dedent(r))); }
});

test('generated file has no Node module syntax', () => {
  assert.doesNotMatch(generated, /\bmodule\.exports\b|\bexports\.|\brequire\b/);
});

// Patterns Learn says the validator rejects:
// https://learn.microsoft.com/en-us/power-pages/configure/author-server-logic#limitations
test('generated file contains none of the documented restricted patterns', () => {
  const restricted = [
    '__dirname', '__filename', 'import(', 'import from', 'eval(', 'Function(',
    'setTimeout(', 'setInterval(', 'setImmediate(', 'process.exit', 'process.kill',
    'child_process', 'fs.', 'require(', 'constructor.constructor', 'this.constructor',
    'arguments.callee', 'with(', 'delete', 'Object.getPrototypeOf',
    'Object.setPrototypeOf', 'Proxy(', 'Reflect.', 'Symbol.for', '__proto__',
    'prototype', 'debugger', 'fetch(', 'XMLHttpRequest'
  ];
  for (const p of restricted) {
    assert.ok(!generated.includes(p), 'contains restricted pattern: ' + p);
  }
});

// ---- 2. shared vectors through the entry point --------------------------

const dir = path.join(__dirname, '..', '..', 'legacy-logic', 'test-vectors');
const serverRules = new Set(['E1', 'E2', 'E3', 'F1', 'F2', 'F3', 'F4', 'F5', 'S1']);
const vectors = [];
for (const f of ['eligibility.json', 'fees.json', 'status.json']) {
  for (const c of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
    if (serverRules.has(c.rule)) { vectors.push(c); }
  }
}

test.describe('shared vectors via post()', () => {
  for (const c of vectors) {
    test(c.id + ' ' + c.note, () => {
      const actual = runVectorOnServer(c);
      assert.deepEqual(actual, c.expected);
      // Same answer as the client-side port.
      assert.deepEqual(actual, rules.runVector(c));
    });
  }
});

test('every server rule has vectors', () => {
  for (const r of serverRules) { assert.ok(vectors.some((c) => c.rule === r), 'no vector for ' + r); }
});

// ---- 3. trust behaviour --------------------------------------------------

test('S1 ignores a role sent by the client', () => {
  const user = { contactid: 'c-1', fullname: 'Applicant Only' };
  const { result } = post('transition', { from: 'Submitted', to: 'UnderReview', role: 'Reviewer' },
    { user, webRoles: ['Northbank Applicant'] });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.roles, ['Applicant']);
});

test('S1 denies an anonymous caller', () => {
  const { result } = post('transition', { from: 'Draft', to: 'Submitted', role: 'Applicant' });
  assert.equal(result.allowed, false);
});

test('recalculateFee uses stored values, not client values, and writes the fee', () => {
  const { result, stub } = post('recalculateFee',
    { applicationId: 'a-1', category: 'Community', fee: 0.01 },
    { application: { nb_eventcategory: 'Sports', nb_expectedattendance: 0,
      nb_isregisterednonprofit: true, nb_islateexception: true } });
  assert.equal(result.fee, 150.08); // F5-08 case: 75.075 + 75.00, half-up
  assert.deepEqual(stub.updates, [{ entitySet: 'nb_permitapplications', id: 'a-1', payload: { nb_feeamount: 150.08 } }]);
});

test('GET fee quote parses query string values', () => {
  const { result } = invoke('get', { method: 'GET',
    query: { category: 'Sports', expectedAttendance: '0', isRegisteredNonProfit: 'true', isLateException: 'true' } });
  assert.equal(result.fee, 150.08);
});

test('bad body returns a JSON error string, not an exception', () => {
  const { result, stub } = invoke('post', { body: '{not json' });
  assert.deepEqual(result, { error: 'server_error' });
  assert.equal(stub.log.some((l) => l[0] === 'error'), true);
});

test('unknown operation is rejected', () => {
  assert.deepEqual(post('approve', {}).result, { error: 'unknown_operation' });
});
