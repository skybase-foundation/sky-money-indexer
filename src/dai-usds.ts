import { DaiUsds } from 'generated';

DaiUsds.DaiToUsds.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.DaiToUsdsUpgrade.set({
    id,
    caller: event.params.caller,
    usr: event.params.usr,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Add to running total of daiUpgraded
  const totalId = 'daiUpgraded';
  let total = await context.Total.get(totalId);
  if (!total) {
    total = { id: totalId, total: 0n };
  }
  context.Total.set({ ...total, total: total.total + event.params.wad });
});

DaiUsds.UsdsToDai.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.UsdsToDaiRevert.set({
    id,
    caller: event.params.caller,
    usr: event.params.usr,
    wad: event.params.wad,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Subtract from running total of daiUpgraded (since DAI is being reverted back)
  const totalId = 'daiUpgraded';
  let total = await context.Total.get(totalId);
  if (!total) {
    total = { id: totalId, total: 0n };
  }
  context.Total.set({ ...total, total: total.total - event.params.wad });
});
