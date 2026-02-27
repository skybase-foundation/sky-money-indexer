import {
  RewardsUsdsSky,
  RewardsUsdsSpk,
  RewardsLsmkrUsds,
  RewardsLsskyUsds,
  RewardsLsskySpk,
  RewardsLsskySky,
  RewardsUsdsClePoints,
} from 'generated';
import type {
  handlerContext,
  Reward,
  RewardsUsdsSky_RewardPaid_event,
  RewardsUsdsSky_Staked_event,
  RewardsUsdsSky_Withdrawn_event,
  RewardsUsdsSky_Referral_event,
} from 'generated';

// Helper: get or initialize a Reward entity
async function getReward(
  chainId: number,
  rewardAddress: string,
  context: handlerContext,
): Promise<Reward> {
  const rewardId = `${chainId}-${rewardAddress}`;
  let reward = await context.Reward.get(rewardId);
  if (!reward) {
    reward = {
      id: rewardId,
      chainId: chainId,
      address: rewardAddress.toLowerCase(),
      totalSupplied: 0n,
      totalRewardsClaimed: 0n,
      lockstakeActive: false,
      stakingEngineActive: false,
    };
  }
  return reward;
}

// Helper: get or initialize a RewardSupplier entity
async function getRewardSupplier(
  chainId: number,
  rewardId: string,
  userId: string,
  context: handlerContext,
) {
  const rewardSupplierId = `${chainId}-${rewardId}-${userId}`;
  let supplier = await context.RewardSupplier.get(rewardSupplierId);
  if (!supplier) {
    supplier = {
      id: rewardSupplierId,
      chainId: chainId,
      reward_id: rewardId,
      user: userId,
      amount: 0n,
    };
  }
  return supplier;
}

// Handler logic: RewardPaid (RewardClaimed)
async function handleRewardClaimed(
  event: RewardsUsdsSky_RewardPaid_event,
  context: handlerContext,
) {
  const reward = await getReward(event.chainId, event.srcAddress, context);

  const entityId = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  context.RewardClaim.set({
    id: entityId,
    chainId: event.chainId,
    user: event.params.user,
    amount: event.params.reward,
    reward_id: reward.id,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  context.Reward.set({
    ...reward,
    totalRewardsClaimed: reward.totalRewardsClaimed + event.params.reward,
  });
}

// Handler logic: Staked (RewardSupplied)
async function handleRewardSupplied(
  event: RewardsUsdsSky_Staked_event,
  context: handlerContext,
) {
  const reward = await getReward(event.chainId, event.srcAddress, context);

  const entityId = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  context.RewardSupply.set({
    id: entityId,
    chainId: event.chainId,
    user: event.params.user,
    amount: event.params.amount,
    reward_id: reward.id,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Update supplier
  const supplier = await getRewardSupplier(
    event.chainId,
    reward.id,
    event.params.user,
    context,
  );
  context.RewardSupplier.set({
    ...supplier,
    amount: supplier.amount + event.params.amount,
  });

  // Update reward
  const updatedReward = {
    ...reward,
    totalSupplied: reward.totalSupplied + event.params.amount,
  };
  context.Reward.set(updatedReward);

  // Add new TVL event
  context.TvlUpdate.set({
    id: entityId,
    chainId: event.chainId,
    reward_id: reward.id,
    amount: updatedReward.totalSupplied,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
}

// Handler logic: Withdrawn (RewardWithdrawn)
async function handleRewardWithdrawn(
  event: RewardsUsdsSky_Withdrawn_event,
  context: handlerContext,
) {
  const reward = await getReward(event.chainId, event.srcAddress, context);

  const entityId = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  context.RewardWithdraw.set({
    id: entityId,
    chainId: event.chainId,
    user: event.params.user,
    amount: event.params.amount,
    reward_id: reward.id,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Update supplier
  const supplier = await getRewardSupplier(
    event.chainId,
    reward.id,
    event.params.user,
    context,
  );
  context.RewardSupplier.set({
    ...supplier,
    amount: supplier.amount - event.params.amount,
  });

  // Update reward
  const updatedReward = {
    ...reward,
    totalSupplied: reward.totalSupplied - event.params.amount,
  };
  context.Reward.set(updatedReward);

  // Add new TVL event
  context.TvlUpdate.set({
    id: entityId,
    chainId: event.chainId,
    reward_id: reward.id,
    amount: updatedReward.totalSupplied,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
}

// Handler logic: Referral (RewardReferral)
async function handleRewardReferral(
  event: RewardsUsdsSky_Referral_event,
  context: handlerContext,
) {
  const reward = await getReward(event.chainId, event.srcAddress, context);

  const entityId = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const ref = Number(event.params.referral) || 0;

  context.RewardReferral.set({
    id: entityId,
    chainId: event.chainId,
    referral: ref,
    reward_id: reward.id,
    user: event.params.user,
    amount: event.params.amount,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
}

// --- RewardsUsdsSky ---
RewardsUsdsSky.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsUsdsSky.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsUsdsSky.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsUsdsSky.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsUsdsSpk ---
RewardsUsdsSpk.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsUsdsSpk.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsUsdsSpk.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsUsdsSpk.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsmkrUsds ---
RewardsLsmkrUsds.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsLsmkrUsds.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsLsmkrUsds.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsLsmkrUsds.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskyUsds ---
RewardsLsskyUsds.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsLsskyUsds.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsLsskyUsds.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsLsskyUsds.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskySpk ---
RewardsLsskySpk.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsLsskySpk.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsLsskySpk.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsLsskySpk.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskySky ---
RewardsLsskySky.RewardPaid.handler(async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
RewardsLsskySky.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsLsskySky.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsLsskySky.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsUsdsClePoints (no RewardPaid event) ---
RewardsUsdsClePoints.Staked.handler(async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
RewardsUsdsClePoints.Withdrawn.handler(async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
RewardsUsdsClePoints.Referral.handler(async ({ event, context }) => {
  await handleRewardReferral(event, context);
});
