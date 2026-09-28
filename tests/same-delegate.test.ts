import { describe, it } from 'vitest';
import { createTestIndexer } from 'envio';

const OWNER = '0x912ffb0035be799c6257295523975acbb79cd81b';
const INDEX = 0n;
const URN = '0x9aead4b882c02a8061255f20b2a97cead969f020';
const WAD = 19110672737832155886803n;
const DELEGATE_OWNER = '0x3333333333333333333333333333333333333333';
const DELEGATE_CONTRACT = '0x4444444444444444444444444444444444444444';
const DELEGATE_ID = `1-${DELEGATE_CONTRACT}`;
const BLOCK = 22_900_000;

const ENGINES = [
  {
    contract: 'StakingEngine',
    srcAddress: '0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3',
    open: 'StakingOpen',
    lock: 'StakingLock',
    select: 'StakingSelectVoteDelegate',
  },
  {
    contract: 'LockstakeEngine',
    srcAddress: '0x2b16c07d5fd5cc701a0a871eae2aad6da5fc8f12',
    open: 'SealOpen',
    lock: 'SealLock',
    select: 'SealSelectVoteDelegate',
  },
] as const;

describe.each(ENGINES)('$contract SelectVoteDelegate', (engine) => {
  it('leaves the delegate unchanged when the current delegate is selected again', async (t) => {
    const indexer = createTestIndexer();
    const select = (block: number) =>
      ({
        contract: engine.contract,
        event: engine.select,
        srcAddress: engine.srcAddress,
        block: { number: block },
        params: { owner: OWNER, index: INDEX, voteDelegate: DELEGATE_CONTRACT },
      }) as const;

    await indexer.process({
      chains: {
        1: {
          simulate: [
            {
              contract: 'DelegateFactoryV3',
              event: 'CreateVoteDelegate',
              block: { number: BLOCK },
              params: { usr: DELEGATE_OWNER, voteDelegate: DELEGATE_CONTRACT },
            },
            {
              contract: engine.contract,
              event: engine.open,
              srcAddress: engine.srcAddress,
              block: { number: BLOCK + 1 },
              params: { owner: OWNER, index: INDEX, urn: URN },
            },
            {
              contract: engine.contract,
              event: engine.lock,
              srcAddress: engine.srcAddress,
              block: { number: BLOCK + 1 },
              params: { owner: OWNER, index: INDEX, wad: WAD, ref: 0 },
            },
            select(BLOCK + 2),
          ],
        },
      },
    });

    const before = await indexer.Delegate.getOrThrow(DELEGATE_ID);
    t.expect(before.totalDelegated).toBeGreaterThan(0n);
    t.expect(before.delegators).toBe(1);
    const historyBefore = await indexer.DelegationHistory.getAll();

    await indexer.process({
      chains: { 1: { simulate: [select(BLOCK + 3), select(BLOCK + 4)] } },
    });

    const after = await indexer.Delegate.getOrThrow(DELEGATE_ID);
    t.expect(after.totalDelegated).toBe(before.totalDelegated);
    t.expect(after.delegators).toBe(1);
    t.expect(await indexer.DelegationHistory.getAll()).toHaveLength(historyBefore.length);

    const delegations = (await indexer.Delegation.getAll()).filter((d) => d.delegate_id === DELEGATE_ID);
    t.expect(delegations.reduce((sum, d) => sum + d.amount, 0n)).toBe(after.totalDelegated);
  });
});
