import type { handlerContext, SealUrn } from 'generated';
import { ZERO_ADDRESS } from './constants';

export async function getSealUrn(
  urnAddress: string,
  chainId: number,
  context: handlerContext,
): Promise<SealUrn> {
  const id = `${chainId}-${urnAddress.toLowerCase()}`;
  let urn = await context.SealUrn.get(id);
  if (!urn) {
    urn = {
      id,
      chainId,
      address: urnAddress.toLowerCase(),
      owner: ZERO_ADDRESS,
      index: 0n,
      blockNumber: 0n,
      blockTimestamp: 0n,
      transactionHash: '0x',
      mkrLocked: 0n,
      usdsDebt: 0n,
      skyLocked: 0n,
      auctionsCount: 0n,
      voteDelegate_id: undefined,
      reward_id: undefined,
    };
  }
  return urn;
}
