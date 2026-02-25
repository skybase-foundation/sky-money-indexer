import { SavingsUsds } from 'generated';

SavingsUsds.Deposit.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.SavingsSupply.set({
    id,
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
  let supplier = await context.SavingsSupplier.get(owner);
  if (!supplier) {
    context.SavingsSupplier.set({ id: owner });
  }
});

SavingsUsds.Withdraw.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.SavingsWithdraw.set({
    id,
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
  const id = `${event.transaction.hash}-${event.logIndex}`;

  const ref = Number(event.params.referral) || 0;

  context.SavingsReferral.set({
    id,
    referral: ref,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
