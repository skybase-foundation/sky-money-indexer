import { CurveUsdsStUsdsPool } from 'generated';
import { readCurvePoolCoinEffect } from './helpers/contractCalls';

CurveUsdsStUsdsPool.TokenExchange.handler(async ({ event, context }) => {
  const entityId = `${event.transaction.hash}-${event.logIndex}`;

  // Kick off both contract calls in parallel at the top of the handler
  const [soldTokenAddress, boughtTokenAddress] = await Promise.all([
    context.effect(readCurvePoolCoinEffect, {
      chainId: event.chainId,
      poolAddress: event.srcAddress,
      index: event.params.sold_id,
    }),
    context.effect(readCurvePoolCoinEffect, {
      chainId: event.chainId,
      poolAddress: event.srcAddress,
      index: event.params.bought_id,
    }),
  ]);

  context.CurveTokenExchange.set({
    id: entityId,
    buyer: event.params.buyer,
    soldId: event.params.sold_id,
    amountSold: event.params.tokens_sold,
    boughtId: event.params.bought_id,
    amountBought: event.params.tokens_bought,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    soldTokenAddress,
    boughtTokenAddress,
  });
});
