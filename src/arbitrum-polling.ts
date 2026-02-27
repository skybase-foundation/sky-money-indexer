import { PollingEmitterArbitrum } from 'generated';

// Helper: get or create an ArbitrumVoter entity
async function getArbitrumVoter(address: string, chainId: number, context: any) {
  const id = `${chainId}-${address}`;
  let voter = await context.ArbitrumVoter.get(id);
  if (!voter) {
    voter = {
      id,
      chainId: chainId,
      address: address.toLowerCase(),
      numberPollVotes: 0,
      lastVotedTimestamp: 0n,
    };
  }
  return voter;
}

// Handler logic: Voted
PollingEmitterArbitrum.Voted.handler(async ({ event, context }) => {
  const sender = event.params.voter;
  const pollId = `${event.chainId}-${event.params.pollId.toString()}`;
  const optionId = event.params.optionId;

  const voter = await getArbitrumVoter(sender, event.chainId, context);

  const voteId = `${event.chainId}-${pollId}-${sender}-${event.block.number}`;

  let pollVote = await context.ArbitrumPollVote.get(voteId);
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

  let poll = await context.ArbitrumPoll.get(pollId);
  if (!poll) {
    poll = {
      id: pollId,
      chainId: event.chainId,
      pollId: Number(event.params.pollId),
      blockCreated: undefined,
      blockWithdrawn: undefined,
      creator: undefined,
      endDate: undefined,
      multiHash: undefined,
      startDate: undefined,
      url: undefined,
      withdrawnBy: undefined,
    };
    context.ArbitrumPoll.set(poll);
  }

  context.ArbitrumPollVote.set({
    id: voteId,
    chainId: event.chainId,
    voter_id: voter.id,
    poll_id: poll.id,
    choice: optionId,
    block: BigInt(event.block.number),
    blockTime: BigInt(event.block.timestamp),
    txnHash: event.transaction.hash,
  });

  context.ArbitrumVoter.set(updatedVoter);
});

// Handler logic: PollCreated
PollingEmitterArbitrum.PollCreated.handler(async ({ event, context }) => {
  const creator = event.params.creator;
  const blockCreated = event.params.blockCreated;
  const pollId = `${event.chainId}-${event.params.pollId.toString()}`;
  const startDate = event.params.startDate;
  const endDate = event.params.endDate;
  const multiHash = event.params.multiHash;
  const url = event.params.url;

  let poll = await context.ArbitrumPoll.get(pollId);

  if (!poll) {
    poll = {
      id: pollId,
      chainId: event.chainId,
      pollId: Number(event.params.pollId),
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

  // Always update poll properties, in case it was previously created with just an id in the vote handler
  context.ArbitrumPoll.set({
    ...poll,
    pollId: Number(event.params.pollId),
    creator: creator,
    blockCreated: blockCreated,
    startDate: startDate,
    endDate: endDate,
    multiHash: multiHash,
    url: url,
  });
});
