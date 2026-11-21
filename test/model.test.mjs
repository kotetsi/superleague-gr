import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProbs, marketXG, devig } from '../src/model.mjs';
import { seasonCode } from '../src/season.mjs';

test('πιθανότητες αθροίζουν 1 και το φαβορί είναι ο ισχυρός', () => {
  const p = matchProbs(2.2, 0.7);
  assert.ok(Math.abs(p.h + p.d + p.a - 1) < 1e-9);
  assert.ok(p.h > 0.6 && p.a < 0.15);
});
test('γκολ αγοράς από αποδόσεις', () => {
  const [l, m] = marketXG({ odds: [1.2, 6.5, 14], ou: [1.6, 2.4] });
  assert.ok(l > m && l + m > 2.5);
  assert.deepEqual(devig(2, 2).map(x => +x.toFixed(2)), [0.5, 0.5]);
});
test('κωδικός σεζόν', () => {
  assert.equal(seasonCode(new Date('2026-11-21')), '2627');
  assert.equal(seasonCode(new Date('2027-03-01')), '2627');
  assert.equal(seasonCode(new Date('2027-08-01')), '2728');
});
