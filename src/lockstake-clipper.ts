import { LockstakeClipper } from 'generated';

LockstakeClipper.Rely.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Rely.set({
    id,
    chainId: event.chainId,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.Deny.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Deny.set({
    id,
    chainId: event.chainId,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.FileUint.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.FileUint.set({
    id,
    chainId: event.chainId,
    what: event.params.what,
    data: event.params.data,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.FileAddress.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.FileAddress.set({
    id,
    chainId: event.chainId,
    what: event.params.what,
    data: event.params.data,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.Kick.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Kick.set({
    id,
    chainId: event.chainId,
    top: event.params.top,
    tab: event.params.tab,
    lot: event.params.lot,
    usr: event.params.usr,
    kpr: event.params.kpr,
    coin: event.params.coin,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.Take.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Take.set({
    id,
    chainId: event.chainId,
    max: event.params.max,
    price: event.params.price,
    owe: event.params.owe,
    tab: event.params.tab,
    lot: event.params.lot,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.Redo.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Redo.set({
    id,
    chainId: event.chainId,
    top: event.params.top,
    tab: event.params.tab,
    lot: event.params.lot,
    usr: event.params.usr,
    kpr: event.params.kpr,
    coin: event.params.coin,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeClipper.Yank.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.Yank.set({
    id,
    chainId: event.chainId,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
