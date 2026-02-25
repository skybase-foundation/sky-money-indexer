export async function getRewardSupplier(
  rewardId: string,
  userId: string,
  context: any,
) {
  const id = `${rewardId}-${userId}`;
  let supplier = await context.RewardSupplier.get(id);
  if (!supplier) {
    supplier = {
      id,
      reward_id: rewardId,
      user: userId,
      amount: 0n,
    };
  }
  return supplier;
}
