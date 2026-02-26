import { StakingEngine } from 'generated';
import { getStakingEngineUrn } from './helpers/getStakingEngineUrn';
import {
  getDelegate,
  delegationLockHandler,
  delegationFreeHandler,
} from './helpers/delegates/index';
import { getReward } from './helpers/getReward';
import { readOwnerUrnsEffect } from './helpers/contractCalls';
import { ZERO_ADDRESS } from './helpers/constants';

StakingEngine.StakingOpen.handler(async ({ event, context }) => {
  let urn = await getStakingEngineUrn(event.params.urn, event.chainId, context);

  const updatedUrn = {
    ...urn,
    owner: event.params.owner,
    index: event.params.index,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  };

  context.StakingUrn.set(updatedUrn);

  context.StakingOpen.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    owner: event.params.owner,
    index: event.params.index,
    urn: event.params.urn,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

StakingEngine.StakingSelectVoteDelegate.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  const oldDelegateAddress = urn.voteDelegate_id;
  let oldDelegate: any | null = null;
  if (oldDelegateAddress) {
    oldDelegate = await getDelegate(oldDelegateAddress, event.chainId, context);
  }
  const newDelegateAddress = event.params.voteDelegate;
  let newDelegate = await getDelegate(newDelegateAddress, event.chainId, context);

  // if voteDelegate address is zero address, urn is undelegating
  if (newDelegateAddress === ZERO_ADDRESS) {
    context.StakingSelectVoteDelegate.set({
      id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
      urn_id: urn.id,
      index: event.params.index,
      voteDelegate_id: undefined,
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      transactionHash: event.transaction.hash,
      chainId: event.chainId,
    });

    context.StakingUrn.set({
      ...urn,
      voteDelegate_id: undefined,
    });

    // handle delegation free
    if (oldDelegate && urn.skyLocked > 0n) {
      await delegationFreeHandler(
        oldDelegate,
        urn.owner,
        urn.skyLocked,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        false,
        true,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
    return;
  } else {
    // delegate should always be found
    if (newDelegate) {
      context.StakingSelectVoteDelegate.set({
        id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
        urn_id: urn.id,
        index: event.params.index,
        voteDelegate_id: newDelegate.id,
        blockNumber: BigInt(event.block.number),
        blockTimestamp: BigInt(event.block.timestamp),
        transactionHash: event.transaction.hash,
        chainId: event.chainId,
      });

      context.StakingUrn.set({
        ...urn,
        voteDelegate_id: newDelegate.id,
      });

      // handle delegation change
      if (oldDelegate && urn.skyLocked > 0n) {
        await delegationFreeHandler(
          oldDelegate,
          urn.owner,
          urn.skyLocked,
          BigInt(event.block.timestamp),
          BigInt(event.block.number),
          event.transaction.hash,
          false,
          true,
          event.logIndex.toString(),
          event.chainId,
          context,
        );
      }
      if (urn.skyLocked > 0n) {
        await delegationLockHandler(
          newDelegate,
          urn.owner,
          urn.skyLocked,
          BigInt(event.block.timestamp),
          BigInt(event.block.number),
          event.transaction.hash,
          false,
          true,
          event.logIndex.toString(),
          event.chainId,
          context,
        );
      }
    }
  }
});

StakingEngine.StakingSelectFarm.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);
  let reward = await getReward(event.params.farm, event.chainId, context);

  const ref = Number(event.params.ref) || 0;

  context.StakingSelectReward.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    reward_id: reward.id,
    ref,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    reward_id: reward.id,
  });
});

StakingEngine.StakingLock.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  const ref = Number(event.params.ref) || 0;

  context.StakingLock.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    wad: amount,
    ref,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    skyLocked: urn.skyLocked + amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(urn.voteDelegate_id, event.chainId, context);
    if (delegate) {
      await delegationLockHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        false,
        true,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

StakingEngine.StakingFree.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  context.StakingFree.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    to: event.params.to,
    wad: amount,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    skyLocked: urn.skyLocked - amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(urn.voteDelegate_id, event.chainId, context);
    if (delegate) {
      await delegationFreeHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        false,
        true,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

StakingEngine.StakingFreeNoFee.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  context.StakingFreeNoFee.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    to: event.params.to,
    wad: amount,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    skyLocked: urn.skyLocked - amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(urn.voteDelegate_id, event.chainId, context);
    if (delegate) {
      await delegationFreeHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        false,
        true,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

StakingEngine.StakingDraw.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  context.StakingDraw.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    to: event.params.to,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    usdsDebt: urn.usdsDebt + event.params.wad,
  });
});

StakingEngine.StakingWipe.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  context.StakingWipe.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    usdsDebt: urn.usdsDebt - event.params.wad,
  });
});

StakingEngine.StakingGetReward.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getStakingEngineUrn(urnAddress, event.chainId, context);

  context.StakingGetReward.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    reward: event.params.farm,
    to: event.params.to,
    amt: event.params.amt,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

StakingEngine.StakingOnKick.handler(async ({ event, context }) => {
  let urn = await getStakingEngineUrn(event.params.urn, event.chainId, context);

  context.StakingOnKick.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.StakingUrn.set({
    ...urn,
    auctionsCount: urn.auctionsCount + 1n,
  });
});

StakingEngine.StakingAddFarm.handler(async ({ event, context }) => {
  let reward = await getReward(event.params.farm, event.chainId, context);
  context.Reward.set({
    ...reward,
    stakingEngineActive: true,
  });
});

StakingEngine.StakingDelFarm.handler(async ({ event, context }) => {
  let reward = await getReward(event.params.farm, event.chainId, context);
  context.Reward.set({
    ...reward,
    stakingEngineActive: false,
  });
});
