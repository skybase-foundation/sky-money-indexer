import type { handlerContext, Reward } from 'generated';

export async function getReward(
  rewardAddress: string,
  chainId: number,
  context: handlerContext,
): Promise<Reward> {
  const id = `${chainId}-${rewardAddress.toLowerCase()}`;
  let reward = await context.Reward.get(id);
  if (!reward) {
    reward = {
      id,
      chainId,
      address: rewardAddress.toLowerCase(),
      totalSupplied: 0n,
      totalRewardsClaimed: 0n,
      lockstakeActive: false,
      stakingEngineActive: false,
    };
  }
  return reward;
}
