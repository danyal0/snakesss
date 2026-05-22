import { Vote, VoteResult, RoundVotes, Player } from '@snakesss/shared-types';

export function tallyVotes(
  votes: Vote[],
  players: Player[]
): VoteResult | null {
  if (votes.length === 0) return null;

  const counts: Record<string, number> = {};
  const voters: Record<string, string[]> = {};

  for (const vote of votes) {
    counts[vote.targetId] = (counts[vote.targetId] || 0) + 1;
    voters[vote.targetId] = [...(voters[vote.targetId] || []), vote.voterId];
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const [topId, topCount] = sorted[0];
  const isTie = sorted.length > 1 && sorted[1][1] === topCount;

  const targetPlayer = players.find((p) => p.id === topId);

  return {
    targetId: topId,
    targetName: targetPlayer?.username ?? 'Unknown',
    voteCount: topCount,
    voters: voters[topId] ?? [],
    isTie,
  };
}

export function resolveTie(
  votes: Vote[],
  alivePlayers: Player[]
): VoteResult | null {
  const counts: Record<string, number> = {};
  const voters: Record<string, string[]> = {};

  for (const vote of votes) {
    counts[vote.targetId] = (counts[vote.targetId] || 0) + 1;
    voters[vote.targetId] = [...(voters[vote.targetId] || []), vote.voterId];
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const tied = sorted.filter(([, c]) => c === sorted[0][1]);
  // Deterministic tie-breaker (lowest player id wins)
  tied.sort((a, b) => a[0].localeCompare(b[0]));
  const [winId, winCount] = tied[0]!;
  const targetPlayer = alivePlayers.find((p) => p.id === winId);

  return {
    targetId: winId,
    targetName: targetPlayer?.username ?? 'Unknown',
    voteCount: winCount,
    voters: voters[winId] ?? [],
    isTie: true,
  };
}

export function buildRoundVotes(
  round: number,
  currentVotes: Record<string, string>,
  players: Player[]
): RoundVotes {
  const votes: Vote[] = Object.entries(currentVotes).map(([voterId, targetId]) => ({
    voterId,
    targetId,
    round,
    timestamp: Date.now(),
  }));

  const result = tallyVotes(votes, players);
  const finalResult = result?.isTie ? resolveTie(votes, players) : result;

  return {
    round,
    votes,
    result: finalResult,
    eliminatedId: finalResult?.targetId ?? null,
  };
}
