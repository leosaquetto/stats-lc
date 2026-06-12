import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFriendActivity } from './friendActivity.ts';

const activity = (name: string, timestamp: string, isNow = false) => ({
  track: { name },
  timestamp,
  isNow,
});

test('Peter uses the newer full history instead of an older recent row', () => {
  const selected = selectFriendActivity(
    activity('Older recent', '2026-06-01T12:00:00.000Z'),
    activity('really dont like u', '2026-06-07T12:00:00.000Z')
  );

  assert.equal((selected?.track as any).name, 'really dont like u');
});

test('Savio and Benante keep full history when recent is empty', () => {
  const history = activity('labyrinth', '2026-06-07T12:00:00.000Z');
  assert.equal(selectFriendActivity(null, history), history);
  assert.equal(selectFriendActivity(undefined, history), history);
});

test('a proven live row wins even when full history has a newer timestamp', () => {
  const live = activity('Live recent', '2026-06-06T12:00:00.000Z', true);
  const history = activity('Stored history', '2026-06-07T12:00:00.000Z');

  assert.equal(selectFriendActivity(live, history), live);
});

test('initial activity participates in timestamp comparison', () => {
  const selected = selectFriendActivity(
    activity('Old recent', '2026-06-01T12:00:00.000Z'),
    activity('Old history', '2026-06-02T12:00:00.000Z'),
    activity('New initial', '2026-06-03T12:00:00.000Z')
  );

  assert.equal((selected?.track as any).name, 'New initial');
});
