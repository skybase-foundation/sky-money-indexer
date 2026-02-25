import { McdDog } from 'generated';

McdDog.Bark.handler(async ({ event, context }) => {
  const barkId = `${event.params.ilk}-${event.params.id}`;

  // Attempt to load existing SealUrn
  const urnAddress = event.params.urn;
  const sealUrn = await context.SealUrn.get(urnAddress);
  const stakingUrn = await context.StakingUrn.get(urnAddress);

  context.Bark.set({
    id: barkId,
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
