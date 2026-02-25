import { PollingEmitter, PollingEmitterV2, BigDecimal } from 'generated';

// Helper: get or create a Voter entity
async function getVoter(address: string, context: any) {
  let voter = await context.Voter.get(address);
  if (!voter) {
    voter = {
      id: address,
      isVoteDelegate: false,
      isVoteProxy: false,
      mkrLockedInChiefRaw: 0n,
      mkrLockedInChief: new BigDecimal('0.0'),
      skyLockedInChiefRaw: 0n,
      skyLockedInChief: new BigDecimal('0.0'),
      currentSpells: [],
      currentSpellsV2: [],
      numberExecutiveVotes: 0,
      numberExecutiveVotesV2: 0,
      numberPollVotes: 0,
      lastVotedTimestamp: 0n,
      delegateContract_id: undefined,
      proxyContract_id: undefined,
    };
  }
  return voter;
}

// Helper: create a default Poll entity with all required fields
function createDefaultPoll(pollId: string) {
  return {
    id: pollId,
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
async function handlePollCreated(event: any, context: any) {
  const creator = event.params.creator;
  const blockCreated = event.params.blockCreated;
  const pollId = event.params.pollId.toString();
  const startDate = event.params.startDate;
  const endDate = event.params.endDate;
  const multiHash = event.params.multiHash;

  let poll = await context.Poll.get(pollId);

  if (!poll) {
    poll = createDefaultPoll(pollId);
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
async function handlePollWithdrawn(event: any, context: any) {
  const creator = event.params.creator;
  const blockWithdrawn = event.params.blockWithdrawn;
  const pollId = event.params.pollId.toString();

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
async function handlePollVote(event: any, context: any) {
  const sender = event.params.voter;
  const pollId = event.params.pollId.toString();
  const optionId = event.params.optionId;

  const voter = await getVoter(sender, context);

  let poll = await context.Poll.get(pollId);
  if (!poll) {
    // Poll won't exist if it was created on arbitrum
    poll = createDefaultPoll(pollId);
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
