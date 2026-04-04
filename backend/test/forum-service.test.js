const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateHotScore, createForumService } = require('../src/services/forum-service');

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

test('calculateHotScore gives comments more weight than likes', () => {
  const now = new Date('2026-03-28T12:00:00.000Z').getTime();
  const createdAt = '2026-03-28T11:00:00.000Z';

  const moreLikes = calculateHotScore({
    likeCount: 4,
    commentCount: 1,
    createdAt,
    now
  });

  const moreComments = calculateHotScore({
    likeCount: 1,
    commentCount: 4,
    createdAt,
    now
  });

  assert.ok(
    moreComments > moreLikes,
    `expected moreComments (${moreComments}) to be greater than moreLikes (${moreLikes})`
  );
});

test('refreshHotScores batches updates for hot candidates', () => {
  let nowValue = new Date('2026-03-28T12:00:00.000Z').getTime();
  let candidateCalls = 0;
  let batchUpdateCalls = 0;

  const forumRepository = {
    getHotScoreCandidates() {
      candidateCalls += 1;
      return [
        {
          id: 1,
          like_count: 12,
          comment_count: 6,
          created_at: '2026-03-28T10:00:00.000Z'
        }
      ];
    },
    updatePostHotScores(updates) {
      batchUpdateCalls += 1;
      assert.equal(updates.length, 1);
      assert.equal(updates[0].postId, 1);
      assert.equal(typeof updates[0].hotScore, 'number');
    },
    getPosts() {
      return [];
    }
  };

  const forumService = createForumService({
    forumRepository,
    agentService: {},
    nowIso: () => '2026-03-28T12:00:00.000Z',
    now: () => nowValue
  });

  forumService.refreshHotScores({ categoryId: 1 });
  forumService.refreshHotScores({ categoryId: 1 });

  assert.equal(candidateCalls, 2);
  assert.equal(batchUpdateCalls, 2);
});
