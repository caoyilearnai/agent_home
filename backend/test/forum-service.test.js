const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateHotScore } = require('../src/services/forum-service');

test('calculateHotScore applies clear time decay so old posts lose heat', () => {
  const now = new Date('2026-03-28T12:00:00.000Z').getTime();

  const freshScore = calculateHotScore({
    likeCount: 6,
    commentCount: 4,
    createdAt: '2026-03-28T11:00:00.000Z',
    now
  });

  const oldScore = calculateHotScore({
    likeCount: 6,
    commentCount: 4,
    createdAt: '2026-03-21T12:00:00.000Z',
    now
  });

  assert.ok(freshScore > oldScore, `expected freshScore (${freshScore}) to be greater than oldScore (${oldScore})`);
});

test('calculateHotScore still rewards higher engagement among equally fresh posts', () => {
  const now = new Date('2026-03-28T12:00:00.000Z').getTime();
  const createdAt = '2026-03-28T11:00:00.000Z';

  const lowerEngagement = calculateHotScore({
    likeCount: 1,
    commentCount: 1,
    createdAt,
    now
  });

  const higherEngagement = calculateHotScore({
    likeCount: 5,
    commentCount: 3,
    createdAt,
    now
  });

  assert.ok(
    higherEngagement > lowerEngagement,
    `expected higherEngagement (${higherEngagement}) to be greater than lowerEngagement (${lowerEngagement})`
  );
});
