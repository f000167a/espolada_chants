const test = require('node:test');
const assert = require('node:assert/strict');
const { todayInJapan, isPastUnreported, nextMatch } = require('../assets/schedule.js');
const schedule = require('../schedule.json');
const now = new Date('2026-10-16T14:00:00Z');
const match = (node, date, result = null, time = '13:00') => ({ node, date, result, time });

test('existing schedule selects October 25, not the unreported May opener', () => {
  assert.equal(nextMatch(schedule.matches, now).node, 16);
  assert.equal(schedule.matches[0].result, null);
});

test('today is computed in Japan across the UTC date boundary', () => {
  assert.equal(todayInJapan(new Date('2026-10-16T14:59:59Z')), '2026-10-16');
  assert.equal(todayInJapan(new Date('2026-10-16T15:00:00Z')), '2026-10-17');
});

test('keeps a same-day match visible until its result is known', () => {
  const today = match(1, '2026-10-16');
  assert.equal(nextMatch([today, match(2, '2026-10-17')], now), today);
  today.result = '○ 3-2';
  assert.equal(nextMatch([today, match(2, '2026-10-17')], now).node, 2);
});

test('orders scheduled matches without mutating the original data', () => {
  const matches = [match(3, '2026-10-20'), match(2, '2026-10-19', null, '15:00'), match(1, '2026-10-19', null, '13:00')];
  const original = JSON.stringify(matches);
  assert.equal(nextMatch(matches, now).node, 1);
  assert.equal(JSON.stringify(matches), original);
});

test('undated postponed game does not hide a confirmed upcoming game', () => {
  assert.equal(nextMatch([match(1, null), match(2, '2026-10-20')], now).node, 2);
  assert.equal(nextMatch([match(1, null), match(2, '2026-10-15')], now).node, 1);
});

test('no upcoming match does not reselect a past unreported game', () => {
  assert.equal(nextMatch([match(1, '2026-10-15')], now), null);
  assert.equal(nextMatch([], now), null);
  assert.equal(nextMatch([match(1, '2026-10-20', '△ 2-2')], now), null);
});

test('only dated past matches without results are marked unreported', () => {
  assert.equal(isPastUnreported(match(1, '2026-10-15'), now), true);
  assert.equal(isPastUnreported(match(1, '2026-10-16'), now), false);
  assert.equal(isPastUnreported(match(1, '2026-10-20'), now), false);
  assert.equal(isPastUnreported(match(1, null), now), false);
  assert.equal(isPastUnreported(match(1, '2026-10-15', '● 1-4'), now), false);
});
