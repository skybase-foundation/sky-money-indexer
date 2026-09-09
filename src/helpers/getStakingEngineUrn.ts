import type { EvmOnEventContext, Entity } from 'envio';
import { ZERO_ADDRESS } from './constants';

type StakingUrn = Entity<'StakingUrn'>;

export async function getStakingEngineUrn(
  urnAddress: string,
  chainId: number,
  context: EvmOnEventContext,
): Promise<StakingUrn> {
  if (!urnAddress || urnAddress === ZERO_ADDRESS) {
    // A zero urn address means the (owner, index) -> urn resolution failed.
    // Throw so Envio retries the batch instead of persisting a phantom urn.
    throw new Error(`Refusing to load urn with zero address on chain ${chainId}`);
  }
  const id = `${chainId}-${urnAddress}`;
  let urn = await context.StakingUrn.get(id);
  if (!urn) {
    urn = {
      id,
      chainId,
      address: urnAddress,
      owner: ZERO_ADDRESS,
      index: 0n,
      blockNumber: 0n,
      blockTimestamp: 0n,
      transactionHash: '0x',
      usdsDebt: 0n,
      skyLocked: 0n,
      auctionsCount: 0n,
      voteDelegate_id: undefined,
      reward_id: undefined,
    };
  }
  return urn;
}
