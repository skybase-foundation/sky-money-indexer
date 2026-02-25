import { DelegateFactoryV3, BigDecimal } from 'generated';

// Register dynamic contract for VoteDelegateV3 when CreateVoteDelegate is emitted
DelegateFactoryV3.CreateVoteDelegate.contractRegister(({ event, context }) => {
  context.addVoteDelegateV3(event.params.voteDelegate);
});

DelegateFactoryV3.CreateVoteDelegate.handler(async ({ event, context }) => {
  const delegateOwnerAddress = event.params.delegate;
  const delegateContractAddress = event.params.voteDelegate;

  // Create the voter entity
  let voter = await context.Voter.get(delegateContractAddress);
  if (!voter) {
    voter = {
      id: delegateContractAddress,
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
  context.Voter.set({
    ...voter,
    isVoteDelegate: true,
    isVoteProxy: false,
    delegateContract_id: delegateContractAddress,
  });

  // Create the delegate contract
  let delegate = await context.Delegate.get(delegateContractAddress);
  if (!delegate) {
    delegate = {
      id: delegateContractAddress,
      ownerAddress: delegateOwnerAddress,
      voter_id: voter.id,
      delegations: [],
      delegators: 0,
      blockTimestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      txnHash: event.transaction.hash,
      totalDelegated: 0n,
      delegationHistory: [],
      version: '3',
    };
    context.Delegate.set(delegate);
  }

  // Create delegate admin entity
  let delegateAdmin = await context.DelegateAdmin.get(delegateOwnerAddress);
  if (!delegateAdmin) {
    context.DelegateAdmin.set({
      id: delegateOwnerAddress,
      delegateContract_id: delegate.id,
    });
  } else {
    context.DelegateAdmin.set({
      ...delegateAdmin,
      delegateContract_id: delegate.id,
    });
  }
});
