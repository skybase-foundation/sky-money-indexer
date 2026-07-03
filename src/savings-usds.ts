import { indexer } from 'envio';

indexer.onEvent({ contract: 'SavingsUsds', event: 'Deposit' }, async ({ event, context }) => {
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

indexer.onEvent({ contract: 'SavingsUsds', event: 'Withdraw' }, async ({ event, context }) => {
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

indexer.onEvent({ contract: 'SavingsUsds', event: 'Referral' }, async ({ event, context }) => {
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
