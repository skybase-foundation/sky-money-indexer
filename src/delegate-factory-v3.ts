import { DelegateFactoryV3, BigDecimal } from 'generated';

// Register dynamic contract for VoteDelegateV3 when CreateVoteDelegate is emitted
DelegateFactoryV3.CreateVoteDelegate.contractRegister(({ event, context }) => {
  context.addVoteDelegateV3(event.params.voteDelegate);
});

DelegateFactoryV3.CreateVoteDelegate.handler(async ({ event, context }) => {
  const delegateOwnerAddress = event.params.delegate;
  const delegateContractAddress = event.params.voteDelegate;

  const delegateId = `${event.chainId}-${delegateContractAddress.toLowerCase()}`;
  const voterId = `${event.chainId}-${delegateContractAddress.toLowerCase()}`;
  const adminId = `${event.chainId}-${delegateOwnerAddress.toLowerCase()}`;

  // Create the voter entity
  let voter = await context.Voter.get(voterId);
  if (!voter) {
    voter = {
      id: voterId,
      chainId: event.chainId,
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
    delegateContract_id: delegateId,
  });

  // Create the delegate contract
  let delegate = await context.Delegate.get(delegateId);
  if (!delegate) {
    delegate = {
      id: delegateId,
      ownerAddress: delegateOwnerAddress,
      voter_id: voterId,
      delegators: 0,
      blockTimestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      txnHash: event.transaction.hash,
      totalDelegated: 0n,
      version: '3',
      chainId: event.chainId,
    };
    context.Delegate.set(delegate);
  }

  // Create delegate admin entity
  let delegateAdmin = await context.DelegateAdmin.get(adminId);
  if (!delegateAdmin) {
    context.DelegateAdmin.set({
      id: adminId,
      delegateContract_id: delegate.id,
      chainId: event.chainId,
    });
  } else {
    context.DelegateAdmin.set({
      ...delegateAdmin,
      delegateContract_id: delegate.id,
    });
  }
});
