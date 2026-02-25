import { LockstakeMkr } from 'generated';

LockstakeMkr.LockstakeMkrRely.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrRely.set({
    id,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeMkr.LockstakeMkrDeny.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrDeny.set({
    id,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeMkr.Approval.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrApproval.set({
    id,
    owner: event.params.owner,
    spender: event.params.spender,
    value: event.params.value,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

LockstakeMkr.Transfer.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrTransfer.set({
    id,
    from: event.params.from,
    to: event.params.to,
    value: event.params.value,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
