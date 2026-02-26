import { LockstakeMigrator } from 'generated';

LockstakeMigrator.Migrate.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.LockstakeMigrate.set({
    id,
    chainId: event.chainId,
    oldOwner: event.params.oldOwner,
    oldIndex: event.params.oldIndex,
    newOwner: event.params.newOwner,
    newIndex: event.params.newIndex,
    ink: event.params.ink,
    debt: event.params.debt,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
