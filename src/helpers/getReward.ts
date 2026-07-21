import type { EvmOnEventContext, Entity } from "envio";

type Reward = Entity<'Reward'>;

export async function getReward(
  rewardAddress: string,
  chainId: number,
  context: EvmOnEventContext,
): Promise<Reward> {
  const id = `${chainId}-${rewardAddress}`;
  let reward = await context.Reward.get(id);
  if (!reward) {
    reward = {
      id,
      chainId,
      address: rewardAddress,
      totalSupplied: 0n,
      totalRewardsClaimed: 0n,
      lockstakeActive: false,
      stakingEngineActive: false,
    };
  }
  return reward;
}
