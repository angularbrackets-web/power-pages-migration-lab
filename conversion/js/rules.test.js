// Run with: node --test conversion/js
// Loads the shared vectors used by the C# tests and checks every case.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('./rules.js');

const dir = path.join(__dirname, '..', '..', 'legacy-logic', 'test-vectors');
const files = ['eligibility.json', 'validation.json', 'fees.json', 'status.json'];
const all = [];
for (const f of files) {
  const cases = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const c of cases) { all.push(c); }
  test.describe(f, () => {
    for (const c of cases) {
      test(c.id + ' ' + c.note, () => {
        assert.deepEqual(rules.runVector(c), c.expected);
      });
    }
  });
}

test('vector ids are unique and every rule is covered', () => {
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  for (const r of ['E1','E2','E3','V1','V2','V3','V4','F1','F2','F3','F4','F5','S1']) {
    assert.ok(all.some((c) => c.rule === r), 'no vector for ' + r);
  }
});

test('F5 integer-cents rounds 75.075 half-up to 75.08', () => {
  // Sports 150.15, non-profit: 150.15 * 0.5 = 75.075
  assert.equal(rules.calculateFeeCents('Sports', 0, true, false), 7508);
  assert.equal(rules.calculateFee('Sports', 0, true, false), 75.08);
});

test('naive Math.round(x*100)/100 fails on 150.075 (documented parity finding)', () => {
  // Sports 150.15 non-profit (75.075) + 75.00 late fee = 150.075
  assert.equal(150.075 * 100, 15007.499999999998);
  assert.equal(rules.calculateFeeNaive('Sports', 0, true, true), 150.07);
  assert.equal(rules.calculateFee('Sports', 0, true, true), 150.08);
});

test('naive rounding is caught by the shared vectors (F5-08 only)', () => {
  const failing = all
    .filter((c) => JSON.stringify(rules.runVector(c, true)) !== JSON.stringify(c.expected))
    .map((c) => c.id);
  assert.deepEqual(failing, ['F5-08']);
});
