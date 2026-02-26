import { SavingsUsds } from 'generated';

SavingsUsds.Deposit.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.SavingsSupply.set({
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

  // Track unique suppliers
  const owner = event.params.owner;
  const supplierId = `${event.chainId}-${owner}`;
  let supplier = await context.SavingsSupplier.get(supplierId);
  if (!supplier) {
    context.SavingsSupplier.set({ id: supplierId, chainId: event.chainId });
  }
});

SavingsUsds.Withdraw.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.SavingsWithdraw.set({
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

SavingsUsds.Referral.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  const ref = Number(event.params.referral) || 0;

  context.SavingsReferral.set({
    id,
    chainId: event.chainId,
    referral: ref,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
