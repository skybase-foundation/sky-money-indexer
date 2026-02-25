import { MkrSky } from 'generated';

MkrSky.MkrToSky.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.MkrToSkyUpgrade.set({
    id,
    caller: event.params.caller,
    usr: event.params.usr,
    mkrAmt: event.params.mkrAmt,
    skyAmt: event.params.skyAmt,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Add to running total of mkrUpgraded
  const mkrTotalId = 'mkrUpgraded';
  let totalMkrUpgraded = await context.Total.get(mkrTotalId);
  if (!totalMkrUpgraded) {
    totalMkrUpgraded = { id: mkrTotalId, total: 0n };
  }
  context.Total.set({
    ...totalMkrUpgraded,
    total: totalMkrUpgraded.total + event.params.mkrAmt,
  });

  // Add to running total of skyUpgraded
  const skyTotalId = 'skyUpgraded';
  let totalSkyUpgraded = await context.Total.get(skyTotalId);
  if (!totalSkyUpgraded) {
    totalSkyUpgraded = { id: skyTotalId, total: 0n };
  }
  context.Total.set({
    ...totalSkyUpgraded,
    total: totalSkyUpgraded.total + event.params.skyAmt,
  });
});

MkrSky.SkyToMkr.handler(async ({ event, context }) => {
  const id = `${event.transaction.hash}-${event.logIndex}`;

  context.SkyToMkrRevert.set({
    id,
    caller: event.params.caller,
    usr: event.params.usr,
    mkrAmt: event.params.mkrAmt,
    skyAmt: event.params.skyAmt,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Subtract from running total of mkrUpgraded (since MKR is being reverted back)
  const mkrTotalId = 'mkrUpgraded';
  let totalMkrUpgraded = await context.Total.get(mkrTotalId);
  if (!totalMkrUpgraded) {
    totalMkrUpgraded = { id: mkrTotalId, total: 0n };
  }
  context.Total.set({
    ...totalMkrUpgraded,
    total: totalMkrUpgraded.total - event.params.mkrAmt,
  });

  // Subtract from running total of skyUpgraded (since SKY is being reverted back)
  const skyTotalId = 'skyUpgraded';
  let totalSkyUpgraded = await context.Total.get(skyTotalId);
  if (!totalSkyUpgraded) {
    totalSkyUpgraded = { id: skyTotalId, total: 0n };
  }
  context.Total.set({
    ...totalSkyUpgraded,
    total: totalSkyUpgraded.total - event.params.skyAmt,
  });
});
