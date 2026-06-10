import { indexer } from 'envio';
import type { EvmEvent, EvmOnEventContext } from 'envio';
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
  event:
    | EvmEvent<'PollingEmitter', 'PollCreated'>
    | EvmEvent<'PollingEmitterV2', 'PollCreated'>,
  context: EvmOnEventContext,
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
  event:
    | EvmEvent<'PollingEmitter', 'PollWithdrawn'>
    | EvmEvent<'PollingEmitterV2', 'PollWithdrawn'>,
  context: EvmOnEventContext,
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
  event:
    | EvmEvent<'PollingEmitter', 'Voted'>
    | EvmEvent<'PollingEmitterV2', 'Voted'>,
  context: EvmOnEventContext,
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

  const voteId = `${pollId}-${sender}-${event.block.number}`;

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
indexer.onEvent({ contract: 'PollingEmitter', event: 'PollCreated' }, async ({ event, context }) => {
  await handlePollCreated(event, context);
});

indexer.onEvent({ contract: 'PollingEmitter', event: 'PollWithdrawn' }, async ({ event, context }) => {
  await handlePollWithdrawn(event, context);
});

indexer.onEvent({ contract: 'PollingEmitter', event: 'Voted' }, async ({ event, context }) => {
  await handlePollVote(event, context);
});

// --- PollingEmitterV2 ---
indexer.onEvent({ contract: 'PollingEmitterV2', event: 'PollCreated' }, async ({ event, context }) => {
  await handlePollCreated(event, context);
});

indexer.onEvent({ contract: 'PollingEmitterV2', event: 'PollWithdrawn' }, async ({ event, context }) => {
  await handlePollWithdrawn(event, context);
});

indexer.onEvent({ contract: 'PollingEmitterV2', event: 'Voted' }, async ({ event, context }) => {
  await handlePollVote(event, context);
});
