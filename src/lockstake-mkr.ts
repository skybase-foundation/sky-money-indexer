import { indexer } from "envio";

indexer.onEvent({ contract: 'LockstakeMkr', event: 'LockstakeMkrRely' }, async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrRely.set({
    id,
    chainId: event.chainId,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: 'LockstakeMkr', event: 'LockstakeMkrDeny' }, async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrDeny.set({
    id,
    chainId: event.chainId,
    usr: event.params.usr,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: 'LockstakeMkr', event: 'Approval' }, async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrApproval.set({
    id,
    chainId: event.chainId,
    owner: event.params.owner,
    spender: event.params.spender,
    value: event.params.value,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: 'LockstakeMkr', event: 'Transfer' }, async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMkrTransfer.set({
    id,
    chainId: event.chainId,
    from: event.params.from,
    to: event.params.to,
    value: event.params.value,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
