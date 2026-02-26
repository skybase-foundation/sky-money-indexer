import { Stusds } from 'generated';

Stusds.Deposit.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.StusdsDeposit.set({
    id,
    chainId: event.chainId,
    sender: event.params.sender,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

Stusds.Withdraw.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.StusdsWithdraw.set({
    id,
    chainId: event.chainId,
    sender: event.params.sender,
    receiver: event.params.receiver,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

Stusds.Referral.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.StusdsReferral.set({
    id,
    chainId: event.chainId,
    referral: Number(event.params.referral),
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
