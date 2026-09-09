import { describe, it } from 'vitest';
import { createTestIndexer } from 'envio';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const STAKING_ENGINE = '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3';

// Shape of prod tx 0xcb2d00a7d5e706eeac00b3f89cc211f3a32dc428126f747849af449e98e6c608:
// Open + Lock + SelectFarm for a new urn, all in one multicall transaction.
const OWNER = '0x912ffb0035be799c6257295523975acbb79cd81b';
const INDEX = 0n;
const URN = '0x9aead4b882c02a8061255f20b2a97cead969f020';
const WAD = 19110672737832155886803n;
const FARM = '0x38e4254bd82ed5ee97cd1c4278faae748d998865';
const TX_HASH = '0xcb2d00a7d5e706eeac00b3f89cc211f3a32dc428126f747849af449e98e6c608';
const BLOCK = 22_900_000;

describe('StakingEngine urn resolution', () => {
  it('credits a Lock in the same transaction as Open to the opened urn, never a zero urn', async (t) => {
    const indexer = createTestIndexer();

    const result = await indexer.process({
      chains: {
        1: {
          simulate: [
            {
              contract: 'StakingEngine',
              event: 'StakingOpen',
              srcAddress: STAKING_ENGINE,
              block: { number: BLOCK },
              transaction: { hash: TX_HASH },
              params: { owner: OWNER, index: INDEX, urn: URN },
            },
            {
              contract: 'StakingEngine',
              event: 'StakingLock',
              srcAddress: STAKING_ENGINE,
              block: { number: BLOCK },
              transaction: { hash: TX_HASH },
              params: { owner: OWNER, index: INDEX, wad: WAD, ref: 0 },
            },
            {
              contract: 'StakingEngine',
              event: 'StakingSelectFarm',
              srcAddress: STAKING_ENGINE,
              block: { number: BLOCK },
              transaction: { hash: TX_HASH },
              params: { owner: OWNER, index: INDEX, farm: FARM, ref: 0 },
            },
          ],
        },
      },
    });

    t.expect(result.changes.flatMap((c) => c.StakingLock?.sets ?? [])).toHaveLength(1);

    const urn = await indexer.StakingUrn.getOrThrow(`1-${URN}`);
    t.expect(urn.owner).toBe(OWNER);
    t.expect(urn.index).toBe(INDEX);
    t.expect(urn.skyLocked).toBe(WAD);
    t.expect(urn.reward_id).toBe(`1-${FARM}`);

    const locks = await indexer.StakingLock.getAll();
    t.expect(locks).toHaveLength(1);
    t.expect(locks[0]!.urn_id).toBe(`1-${URN}`);
    t.expect(locks[0]!.wad).toBe(WAD);

    const selectRewards = await indexer.StakingSelectReward.getAll();
    t.expect(selectRewards).toHaveLength(1);
    t.expect(selectRewards[0]!.urn_id).toBe(`1-${URN}`);

    // No phantom zero-address urn may ever exist.
    t.expect(await indexer.StakingUrn.get(`1-${ZERO_ADDRESS}`)).toBeUndefined();

    // The owner+index -> urn mapping was persisted by Open.
    const lookup = await indexer.UrnOwnerIndex.getOrThrow(`1-${STAKING_ENGINE}-${OWNER}-${INDEX}`);
    t.expect(lookup.urn).toBe(URN);
  });

  it('refuses to create a StakingUrn for the zero address', async (t) => {
    const indexer = createTestIndexer();

    // Lock without a prior Open and without a lookup entity: resolution must
    // fall back to RPC (pinned to the block) or fail, never silently create
    // a "1-0x000...000" urn.
    const run = indexer.process({
      chains: {
        1: {
          simulate: [
            {
              contract: 'StakingEngine',
              event: 'StakingLock',
              srcAddress: STAKING_ENGINE,
              block: { number: BLOCK },
              transaction: { hash: TX_HASH },
              params: { owner: OWNER, index: 999n, wad: WAD, ref: 0 },
            },
          ],
        },
      },
    });

    await t.expect(run).rejects.toThrow();
    t.expect(await indexer.StakingUrn.get(`1-${ZERO_ADDRESS}`)).toBeUndefined();
  });
});
