import { describe, it } from 'vitest';
import { createTestIndexer } from 'envio';
import { getStakingEngineUrn } from '../src/helpers/getStakingEngineUrn';
import { getSealUrn } from '../src/helpers/getSealUrn';
import { resolveUrnAddress } from '../src/helpers/resolveUrn';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// config.yaml sets address_format: lowercase, so event.srcAddress is lowercased
const STAKING_ENGINE = '0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3';

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

  it('refuses to load a StakingUrn or SealUrn for the zero address', async (t) => {
    const context = { StakingUrn: { get: async () => undefined }, SealUrn: { get: async () => undefined } } as any;
    await t.expect(getStakingEngineUrn(ZERO_ADDRESS, 1, context)).rejects.toThrow(/zero address/);
    await t.expect(getSealUrn(ZERO_ADDRESS, 1, context)).rejects.toThrow(/zero address/);
  });

  it('never resolves the zero address from the RPC fallback', async (t) => {
    const event = {
      chainId: 1,
      srcAddress: STAKING_ENGINE,
      block: { number: BLOCK },
      params: { owner: OWNER, index: 999n },
    };
    const effectCalls: unknown[] = [];
    const context = {
      isPreload: false,
      UrnOwnerIndex: { get: async () => undefined },
      effect: async (_effect: unknown, input: unknown) => {
        effectCalls.push(input);
        // Effect must throw on a zero result; emulate a misbehaving one anyway.
        return ZERO_ADDRESS;
      },
    } as any;
    await t.expect(resolveUrnAddress(event, context)).rejects.toThrow(/Could not resolve urn/);
    t.expect(effectCalls).toEqual([
      { chainId: 1, engineAddress: STAKING_ENGINE, owner: OWNER, index: 999n, blockNumber: BigInt(BLOCK) },
    ]);
  });

  it('does not hit the RPC fallback during the preload pass', async (t) => {
    const event = {
      chainId: 1,
      srcAddress: STAKING_ENGINE,
      block: { number: BLOCK },
      params: { owner: OWNER, index: INDEX },
    };
    let effectCalled = false;
    const context = {
      isPreload: true,
      UrnOwnerIndex: { get: async () => undefined },
      effect: async () => {
        effectCalled = true;
        return URN;
      },
    } as any;
    await t.expect(resolveUrnAddress(event, context)).rejects.toThrow(/preload/);
    t.expect(effectCalled).toBe(false);
  });
});
