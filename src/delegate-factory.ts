import { DelegateFactory, BigDecimal } from 'generated';

// Register dynamic contract for VoteDelegate when CreateVoteDelegate is emitted
DelegateFactory.CreateVoteDelegate.contractRegister(({ event, context }) => {
  context.addVoteDelegate(event.params.voteDelegate);
});

DelegateFactory.CreateVoteDelegate.handler(async ({ event, context }) => {
  // https://etherscan.io/address/0xD897F108670903D1d6070fcf818f9db3615AF272#code
  // event.params.delegate is the owner address
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
  let delegateInfo = await context.Delegate.get(delegateContractAddress);
  if (!delegateInfo) {
    delegateInfo = {
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
      version: '1',
    };
    context.Delegate.set(delegateInfo);
  }

  // Create delegate admin entity, it links the owner address with the delegate contract
  let delegateAdmin = await context.DelegateAdmin.get(delegateOwnerAddress);
  if (!delegateAdmin) {
    context.DelegateAdmin.set({
      id: delegateOwnerAddress,
      delegateContract_id: delegateInfo.id,
    });
  } else {
    context.DelegateAdmin.set({
      ...delegateAdmin,
      delegateContract_id: delegateInfo.id,
    });
  }
});
