import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ageAdmissionPolicy } from '../src/showtime/age-admission-policy';

test('P requires no confirmation', () => assert.equal(ageAdmissionPolicy('P').action, 'ALLOW'));
test('K requires accompanying adult condition, not a minimum age of 13', () => {
  const p = ageAdmissionPolicy('K');
  assert.equal(p.action, 'CONFIRM');
  assert.match(p.message, /người giám hộ/);
});
for (const rating of ['T13', 'T16', 'T18']) {
  test(`${rating} requires the matching age confirmation`, () => {
    const p = ageAdmissionPolicy(rating);
    assert.equal(p.action, 'CONFIRM');
    assert.match(p.message, new RegExp(rating.slice(1)));
    assert.ok(p.confirmLabel);
  });
}
test('C is blocked', () => assert.equal(ageAdmissionPolicy('C').action, 'BLOCK'));
test('missing and invalid classifications are blocked', () => {
  for (const rating of [null, undefined, '', 'INVALID']) assert.equal(ageAdmissionPolicy(rating).action, 'BLOCK');
});
test('classification normalization is stable', () => assert.equal(ageAdmissionPolicy(' t16 ').rating, 'T16'));
