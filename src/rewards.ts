import { indexer } from 'envio';
import type { EvmOnEventContext, EvmEvent, Entity } from 'envio';

type Reward = Entity<'Reward'>;

type RewardsContract =
  | 'RewardsUsdsSky'
  | 'RewardsUsdsSpk'
  | 'RewardsLsmkrUsds'
  | 'RewardsLsskyUsds'
  | 'RewardsLsskySpk'
  | 'RewardsLsskySky'
  | 'RewardsUsdsGrove'
  | 'RewardsUsdsClePoints';

// Helper: get or initialize a Reward entity
async function getReward(
  chainId: number,
  rewardAddress: string,
  context: EvmOnEventContext,
): Promise<Reward> {
  const rewardId = `${chainId}-${rewardAddress}`;
  let reward = await context.Reward.get(rewardId);
  if (!reward) {
    reward = {
      id: rewardId,
      chainId: chainId,
      address: rewardAddress,
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
  context: EvmOnEventContext,
) {
  const rewardSupplierId = `${rewardId}-${userId}`;
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
  event: EvmEvent<RewardsContract, 'RewardPaid'>,
  context: EvmOnEventContext,
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
  event: EvmEvent<RewardsContract, 'Staked'>,
  context: EvmOnEventContext,
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
  event: EvmEvent<RewardsContract, 'Withdrawn'>,
  context: EvmOnEventContext,
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
  event: EvmEvent<RewardsContract, 'Referral'>,
  context: EvmOnEventContext,
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
indexer.onEvent({ contract: 'RewardsUsdsSky', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSky', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSky', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSky', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsUsdsSpk ---
indexer.onEvent({ contract: 'RewardsUsdsSpk', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSpk', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSpk', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsSpk', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsmkrUsds ---
indexer.onEvent({ contract: 'RewardsLsmkrUsds', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsLsmkrUsds', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsLsmkrUsds', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsLsmkrUsds', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskyUsds ---
indexer.onEvent({ contract: 'RewardsLsskyUsds', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskyUsds', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskyUsds', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskyUsds', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskySpk ---
indexer.onEvent({ contract: 'RewardsLsskySpk', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySpk', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySpk', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySpk', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsLsskySky ---
indexer.onEvent({ contract: 'RewardsLsskySky', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySky', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySky', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsLsskySky', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsUsdsGrove ---
indexer.onEvent({ contract: 'RewardsUsdsGrove', event: 'RewardPaid' }, async ({ event, context }) => {
  await handleRewardClaimed(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsGrove', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsGrove', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsGrove', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});

// --- RewardsUsdsClePoints (no RewardPaid event) ---
indexer.onEvent({ contract: 'RewardsUsdsClePoints', event: 'Staked' }, async ({ event, context }) => {
  await handleRewardSupplied(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsClePoints', event: 'Withdrawn' }, async ({ event, context }) => {
  await handleRewardWithdrawn(event, context);
});
indexer.onEvent({ contract: 'RewardsUsdsClePoints', event: 'Referral' }, async ({ event, context }) => {
  await handleRewardReferral(event, context);
});
