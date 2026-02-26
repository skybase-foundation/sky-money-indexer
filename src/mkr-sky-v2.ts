import { MkrSkyV2 } from 'generated';

MkrSkyV2.MkrToSky.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;

  context.MkrToSkyUpgradeV2.set({
    id,
    chainId: event.chainId,
    caller: event.params.caller,
    usr: event.params.usr,
    mkrAmt: event.params.mkrAmt,
    skyAmt: event.params.skyAmt,
    skyFee: event.params.skyFee,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });

  // Add to running total of mkrUpgraded
  const mkrTotalId = `${event.chainId}-mkrUpgraded`;
  let totalMkrUpgraded = await context.Total.get(mkrTotalId);
  if (!totalMkrUpgraded) {
    totalMkrUpgraded = { id: mkrTotalId, chainId: event.chainId, total: 0n };
  }
  context.Total.set({
    ...totalMkrUpgraded,
    total: totalMkrUpgraded.total + event.params.mkrAmt,
  });

  // Add to running total of skyUpgraded
  const skyTotalId = `${event.chainId}-skyUpgraded`;
  let totalSkyUpgraded = await context.Total.get(skyTotalId);
  if (!totalSkyUpgraded) {
    totalSkyUpgraded = { id: skyTotalId, chainId: event.chainId, total: 0n };
  }
  context.Total.set({
    ...totalSkyUpgraded,
    total: totalSkyUpgraded.total + event.params.skyAmt,
  });

  // Add to running total of skyUpgradeFees
  const feeTotalId = `${event.chainId}-skyUpgradeFees`;
  let totalSkyUpgradeFees = await context.Total.get(feeTotalId);
  if (!totalSkyUpgradeFees) {
    totalSkyUpgradeFees = { id: feeTotalId, chainId: event.chainId, total: 0n };
  }
  context.Total.set({
    ...totalSkyUpgradeFees,
    total: totalSkyUpgradeFees.total + event.params.skyFee,
  });
});
