import { describe, expect, it } from 'vitest';
import { createTestIndexer } from 'envio';
import './EventHandlers';

const CALLER = '0x1111111111111111111111111111111111111111';
const USR = '0x2222222222222222222222222222222222222222';
const DELEGATE_OWNER = '0x3333333333333333333333333333333333333333';
const DELEGATE_CONTRACT = '0x4444444444444444444444444444444444444444';

describe('DaiUsds', () => {
  it('records upgrades/reverts and keeps the running daiUpgraded total', async () => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        1: {
          simulate: [
            { contract: 'DaiUsds', event: 'DaiToUsds', params: { caller: CALLER, usr: USR, wad: 1000n } },
            { contract: 'DaiUsds', event: 'DaiToUsds', params: { caller: CALLER, usr: USR, wad: 500n } },
            { contract: 'DaiUsds', event: 'UsdsToDai', params: { caller: CALLER, usr: USR, wad: 300n } },
          ],
        },
      },
    });

    const total = await indexer.Total.getOrThrow('1-daiUpgraded');
    expect(total.total).toBe(1200n);
  });
});

describe('DelegateFactory', () => {
  it('creates voter, delegate, and admin entities on CreateVoteDelegate', async () => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        1: {
          simulate: [
            {
              contract: 'DelegateFactory',
              event: 'CreateVoteDelegate',
              params: { delegate: DELEGATE_OWNER, voteDelegate: DELEGATE_CONTRACT },
            },
          ],
        },
      },
    });

    const voter = await indexer.Voter.getOrThrow(`1-${DELEGATE_CONTRACT}`);
    expect(voter.isVoteDelegate).toBe(true);
    expect(voter.delegateContract_id).toBe(`1-${DELEGATE_CONTRACT}`);

    const delegate = await indexer.Delegate.getOrThrow(`1-${DELEGATE_CONTRACT}`);
    expect(delegate.ownerAddress).toBe(DELEGATE_OWNER);
    expect(delegate.version).toBe('1');

    const admin = await indexer.DelegateAdmin.getOrThrow(`1-${DELEGATE_OWNER}`);
    expect(admin.delegateContract_id).toBe(`1-${DELEGATE_CONTRACT}`);
  });
});
