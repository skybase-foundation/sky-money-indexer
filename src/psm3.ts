import { Psm3 } from 'generated';

Psm3.Swap.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.Swap.set({
    id,
    assetIn: event.params.assetIn,
    assetOut: event.params.assetOut,
    sender: event.params.sender,
    receiver: event.params.receiver,
    amountIn: event.params.amountIn,
    amountOut: event.params.amountOut,
    referralCode: event.params.referralCode,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
