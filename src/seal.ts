import { LockstakeEngine, Delegate } from 'generated';
import { getSealUrn } from './helpers/getSealUrn';
import {
  getDelegate,
  delegationLockHandler,
  delegationFreeHandler,
} from './helpers/delegates/index';
import { getReward } from './helpers/getReward';
import {
  readOwnerUrnsEffect,
  readMkrSkyRateEffect,
} from './helpers/contractCalls';
import { ZERO_ADDRESS } from './helpers/constants';

// MkrSky contract addresses per chain
const MKR_SKY_ADDRESSES: Record<number, string> = {
  1: '0xBDcFCA946b6CDd965f99a839e4435Bcdc1bc470B',
  314310: '0xBDcFCA946b6CDd965f99a839e4435Bcdc1bc470B',
};

LockstakeEngine.SealOpen.handler(async ({ event, context }) => {
  const urn = await getSealUrn(event.params.urn, event.chainId, context);

  const updatedUrn = {
    ...urn,
    owner: event.params.owner,
    index: event.params.index,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  };

  context.SealUrn.set(updatedUrn);

  context.SealOpen.set({
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

LockstakeEngine.SealSelectVoteDelegate.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  const oldDelegateAddress = urn.voteDelegate_id;
  let oldDelegate: Delegate | null = null;
  if (oldDelegateAddress) {
    oldDelegate = await getDelegate(oldDelegateAddress, event.chainId, context);
  }
  const newDelegateAddress = event.params.voteDelegate;
  let newDelegate = await getDelegate(
    newDelegateAddress,
    event.chainId,
    context,
  );

  // if voteDelegate address is zero address, urn is undelegating
  if (newDelegateAddress === ZERO_ADDRESS) {
    context.SealSelectVoteDelegate.set({
      id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
      urn_id: urn.id,
      index: event.params.index,
      voteDelegate_id: undefined,
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      transactionHash: event.transaction.hash,
      chainId: event.chainId,
    });

    context.SealUrn.set({
      ...urn,
      voteDelegate_id: undefined,
    });

    // handle delegation free
    if (oldDelegate && urn.mkrLocked > 0n) {
      await delegationFreeHandler(
        oldDelegate,
        urn.owner,
        urn.mkrLocked,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
    return;
  } else {
    // delegate should always be found
    if (newDelegate) {
      context.SealSelectVoteDelegate.set({
        id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
        urn_id: urn.id,
        index: event.params.index,
        voteDelegate_id: newDelegate.id,
        blockNumber: BigInt(event.block.number),
        blockTimestamp: BigInt(event.block.timestamp),
        transactionHash: event.transaction.hash,
        chainId: event.chainId,
      });

      context.SealUrn.set({
        ...urn,
        voteDelegate_id: newDelegate.id,
      });

      // handle delegation change
      if (oldDelegate && urn.mkrLocked > 0n) {
        await delegationFreeHandler(
          oldDelegate,
          urn.owner,
          urn.mkrLocked,
          BigInt(event.block.timestamp),
          BigInt(event.block.number),
          event.transaction.hash,
          true,
          false,
          event.logIndex.toString(),
          event.chainId,
          context,
        );
      }
      if (urn.mkrLocked > 0n) {
        await delegationLockHandler(
          newDelegate,
          urn.owner,
          urn.mkrLocked,
          BigInt(event.block.timestamp),
          BigInt(event.block.number),
          event.transaction.hash,
          true,
          false,
          event.logIndex.toString(),
          event.chainId,
          context,
        );
      }
    }
  }
});

LockstakeEngine.SealSelectFarm.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);
  let reward = await getReward(event.params.farm, event.chainId, context);

  const ref = Number(event.params.ref) || 0;

  context.SealSelectReward.set({
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

  context.SealUrn.set({
    ...urn,
    reward_id: reward.id,
  });
});

LockstakeEngine.SealAddFarm.handler(async ({ event, context }) => {
  let reward = await getReward(event.params.farm, event.chainId, context);
  context.Reward.set({
    ...reward,
    lockstakeActive: true,
  });
});

LockstakeEngine.SealDelFarm.handler(async ({ event, context }) => {
  let reward = await getReward(event.params.farm, event.chainId, context);
  context.Reward.set({
    ...reward,
    lockstakeActive: false,
  });
});

LockstakeEngine.SealLock.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  const ref = Number(event.params.ref) || 0;

  context.SealLock.set({
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

  context.SealUrn.set({
    ...urn,
    mkrLocked: urn.mkrLocked + amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(
      urn.voteDelegate_id,
      event.chainId,
      context,
    );
    if (delegate) {
      await delegationLockHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

LockstakeEngine.LockSky.handler(async ({ event, context }) => {
  const amount = event.params.skyWad;
  const mkrSkyAddress = MKR_SKY_ADDRESSES[event.chainId];

  // Kick off both contract calls in parallel at the top of the handler
  const [urnAddress, rateMkrSky] = await Promise.all([
    context.effect(readOwnerUrnsEffect, {
      chainId: event.chainId,
      engineAddress: event.srcAddress,
      owner: event.params.owner,
      index: event.params.index,
    }),
    mkrSkyAddress
      ? context.effect(readMkrSkyRateEffect, {
          chainId: event.chainId,
          mkrSkyAddress,
        })
      : Promise.resolve(24000n),
  ]);

  let urn = await getSealUrn(urnAddress, event.chainId, context);

  const ref = Number(event.params.ref) || 0;

  context.SealLockSky.set({
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

  const mkrAmount = amount / rateMkrSky;

  context.SealUrn.set({
    ...urn,
    mkrLocked: urn.mkrLocked + mkrAmount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(
      urn.voteDelegate_id,
      event.chainId,
      context,
    );
    if (delegate) {
      await delegationLockHandler(
        delegate,
        urn.owner,
        mkrAmount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

LockstakeEngine.SealFree.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealFree.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    to: event.params.to,
    wad: amount,
    freed: event.params.freed,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.SealUrn.set({
    ...urn,
    mkrLocked: urn.mkrLocked - amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(
      urn.voteDelegate_id,
      event.chainId,
      context,
    );
    if (delegate) {
      await delegationFreeHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

LockstakeEngine.FreeSky.handler(async ({ event, context }) => {
  const amount = event.params.skyWad;
  const mkrSkyAddress = MKR_SKY_ADDRESSES[event.chainId];

  // Kick off both contract calls in parallel at the top of the handler
  const [urnAddress, rateMkrSky] = await Promise.all([
    context.effect(readOwnerUrnsEffect, {
      chainId: event.chainId,
      engineAddress: event.srcAddress,
      owner: event.params.owner,
      index: event.params.index,
    }),
    mkrSkyAddress
      ? context.effect(readMkrSkyRateEffect, {
          chainId: event.chainId,
          mkrSkyAddress,
        })
      : Promise.resolve(24000n),
  ]);

  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealFreeSky.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    to: event.params.to,
    skyWad: amount,
    skyFreed: event.params.skyFreed,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  const mkrAmount = amount / rateMkrSky;

  context.SealUrn.set({
    ...urn,
    mkrLocked: urn.mkrLocked - mkrAmount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(
      urn.voteDelegate_id,
      event.chainId,
      context,
    );
    if (delegate) {
      await delegationFreeHandler(
        delegate,
        urn.owner,
        mkrAmount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

LockstakeEngine.SealFreeNoFee.handler(async ({ event, context }) => {
  const amount = event.params.wad;
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealFreeNoFee.set({
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

  context.SealUrn.set({
    ...urn,
    mkrLocked: urn.mkrLocked - amount,
  });

  if (urn.voteDelegate_id && amount > 0n) {
    const delegate = await getDelegate(
      urn.voteDelegate_id,
      event.chainId,
      context,
    );
    if (delegate) {
      await delegationFreeHandler(
        delegate,
        urn.owner,
        amount,
        BigInt(event.block.timestamp),
        BigInt(event.block.number),
        event.transaction.hash,
        true,
        false,
        event.logIndex.toString(),
        event.chainId,
        context,
      );
    }
  }
});

LockstakeEngine.SealDraw.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealDraw.set({
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

  context.SealUrn.set({
    ...urn,
    usdsDebt: urn.usdsDebt + event.params.wad,
  });
});

LockstakeEngine.SealWipe.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealWipe.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    index: event.params.index,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.SealUrn.set({
    ...urn,
    usdsDebt: urn.usdsDebt - event.params.wad,
  });
});

LockstakeEngine.GetReward.handler(async ({ event, context }) => {
  const urnAddress = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
  });
  let urn = await getSealUrn(urnAddress, event.chainId, context);

  context.SealGetReward.set({
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

LockstakeEngine.OnKick.handler(async ({ event, context }) => {
  let urn = await getSealUrn(event.params.urn, event.chainId, context);

  context.SealOnKick.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.SealUrn.set({
    ...urn,
    auctionsCount: urn.auctionsCount + 1n,
  });
});

LockstakeEngine.OnTake.handler(async ({ event, context }) => {
  let urn = await getSealUrn(event.params.urn, event.chainId, context);

  context.SealOnTake.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    who: event.params.who,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

LockstakeEngine.OnRemove.handler(async ({ event, context }) => {
  let urn = await getSealUrn(event.params.urn, event.chainId, context);

  context.SealOnRemove.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    urn_id: urn.id,
    sold: event.params.sold,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });

  context.SealUrn.set({
    ...urn,
    auctionsCount: urn.auctionsCount - 1n,
  });
});

LockstakeEngine.SealRely.handler(async ({ event, context }) => {
  context.SealRely.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

LockstakeEngine.SealDeny.handler(async ({ event, context }) => {
  context.SealDeny.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

// SealFileAddress and SealFileUint handlers are commented out in the original

LockstakeEngine.Hope.handler(async ({ event, context }) => {
  context.SealHope.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    owner: event.params.owner,
    index: event.params.index,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});

LockstakeEngine.Nope.handler(async ({ event, context }) => {
  context.SealNope.set({
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    owner: event.params.owner,
    index: event.params.index,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    chainId: event.chainId,
  });
});
