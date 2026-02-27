import { PollingEmitter, PollingEmitterV2 } from 'generated';
import type {
  handlerContext,
  PollingEmitter_PollCreated_event,
  PollingEmitter_PollWithdrawn_event,
  PollingEmitter_Voted_event,
} from 'generated';
import { getVoter } from './helpers/helpers';

// Helper: create a default Poll entity with all required fields
function createDefaultPoll(pollId: string, chainId: number, pollIdNum: bigint) {
  return {
    id: pollId,
    chainId,
    pollId: pollIdNum,
    blockCreated: undefined,
    blockWithdrawn: undefined,
    creator: undefined,
    endDate: undefined,
    multiHash: undefined,
    startDate: undefined,
    url: undefined,
    withdrawnBy: undefined,
  };
}

// Handler logic: PollCreated
async function handlePollCreated(
  event: PollingEmitter_PollCreated_event,
  context: handlerContext,
) {
  const creator = event.params.creator;
  const blockCreated = event.params.blockCreated;
  const pollId = `${event.chainId}-${event.params.pollId.toString()}`;
  const startDate = event.params.startDate;
  const endDate = event.params.endDate;
  const multiHash = event.params.multiHash;

  let poll = await context.Poll.get(pollId);

  if (!poll) {
    poll = createDefaultPoll(
      pollId,
      event.chainId,
      event.params.pollId,
    );
  }

  // Always update poll properties, in case it was previously created with just an id in the vote handler
  context.Poll.set({
    ...poll,
    creator: creator,
    blockCreated: blockCreated,
    startDate: startDate,
    endDate: endDate,
    multiHash: multiHash,
  });
}

// Handler logic: PollWithdrawn
async function handlePollWithdrawn(
  event: PollingEmitter_PollWithdrawn_event,
  context: handlerContext,
) {
  const creator = event.params.creator;
  const blockWithdrawn = event.params.blockWithdrawn;
  const pollId = `${event.chainId}-${event.params.pollId.toString()}`;

  let poll = await context.Poll.get(pollId);

  if (poll) {
    context.Poll.set({
      ...poll,
      blockWithdrawn: blockWithdrawn,
      withdrawnBy: creator,
    });
  }
}

// Handler logic: Voted
async function handlePollVote(
  event: PollingEmitter_Voted_event,
  context: handlerContext,
) {
  const sender = event.params.voter;
  const pollId = `${event.chainId}-${event.params.pollId.toString()}`;
  const optionId = event.params.optionId;

  const voter = await getVoter(sender, event.chainId, context);

  let poll = await context.Poll.get(pollId);
  if (!poll) {
    // Poll won't exist if it was created on arbitrum
    poll = createDefaultPoll(
      pollId,
      event.chainId,
      event.params.pollId,
    );
    context.Poll.set(poll);
  }

  const voteId = `${event.chainId}-${pollId}-${sender}-${event.block.number}`;

  let pollVote = await context.PollVote.get(voteId);
  let updatedVoter = {
    ...voter,
    lastVotedTimestamp: BigInt(event.block.timestamp),
  };

  if (!pollVote) {
    updatedVoter = {
      ...updatedVoter,
      numberPollVotes: updatedVoter.numberPollVotes + 1,
    };
  }

  context.PollVote.set({
    id: voteId,
    chainId: event.chainId,
    voter_id: voter.id,
    poll_id: poll.id,
    choice: optionId,
    block: BigInt(event.block.number),
    blockTime: BigInt(event.block.timestamp),
    txnHash: event.transaction.hash,
  });

  context.Voter.set(updatedVoter);
}

// --- PollingEmitter ---
PollingEmitter.PollCreated.handler(async ({ event, context }) => {
  await handlePollCreated(event, context);
});

PollingEmitter.PollWithdrawn.handler(async ({ event, context }) => {
  await handlePollWithdrawn(event, context);
});

PollingEmitter.Voted.handler(async ({ event, context }) => {
  await handlePollVote(event, context);
});

// --- PollingEmitterV2 ---
PollingEmitterV2.PollCreated.handler(async ({ event, context }) => {
  await handlePollCreated(event, context);
});

PollingEmitterV2.PollWithdrawn.handler(async ({ event, context }) => {
  await handlePollWithdrawn(event, context);
});

PollingEmitterV2.Voted.handler(async ({ event, context }) => {
  await handlePollVote(event, context);
});
