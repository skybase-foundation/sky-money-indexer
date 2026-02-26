import { McdDog } from 'generated';

McdDog.Bark.handler(async ({ event, context }) => {
  const barkId = `${event.chainId}-${event.params.ilk}-${event.params.id}`;

  // Attempt to load existing SealUrn
  const urnAddress = event.params.urn.toLowerCase();
  const sealUrn = await context.SealUrn.get(`${event.chainId}-${urnAddress}`);
  const stakingUrn = await context.StakingUrn.get(`${event.chainId}-${urnAddress}`);

  context.Bark.set({
    id: barkId,
    chainId: event.chainId,
    ilk: event.params.ilk,
    urn: event.params.urn,
    ink: event.params.ink,
    art: event.params.art,
    due: event.params.due,
    clip: event.params.clip,
    clipperId: event.params.id,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    sealUrn_id: sealUrn ? sealUrn.id : undefined,
    stakingUrn_id: stakingUrn ? stakingUrn.id : undefined,
  });
});
