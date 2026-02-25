export async function getReward(rewardAddress: string, context: any) {
  let reward = await context.Reward.get(rewardAddress);
  if (!reward) {
    reward = {
      id: rewardAddress,
      totalSupplied: 0n,
      totalRewardsClaimed: 0n,
      lockstakeActive: false,
      stakingEngineActive: false,
    };
  }
  return reward;
}
