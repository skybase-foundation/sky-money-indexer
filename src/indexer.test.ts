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

const DELEGATORS = [
  '0x5555555555555555555555555555555555555555',
  '0x6666666666666666666666666666666666666666',
  '0x7777777777777777777777777777777777777777',
] as const;
type Delegator = (typeof DELEGATORS)[number];

const VERSIONS = [
  {
    version: 'VoteDelegate',
    createDelegate: {
      contract: 'DelegateFactory',
      event: 'CreateVoteDelegate',
      params: { delegate: DELEGATE_OWNER, voteDelegate: DELEGATE_CONTRACT },
    },
    lock: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegate', event: 'Lock', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
    free: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegate', event: 'Free', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
  },
  {
    version: 'VoteDelegateV2',
    createDelegate: {
      contract: 'DelegateFactoryV2',
      event: 'CreateVoteDelegate',
      params: { usr: DELEGATE_OWNER, voteDelegate: DELEGATE_CONTRACT },
    },
    lock: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegateV2', event: 'Lock', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
    free: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegateV2', event: 'Free', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
  },
  {
    version: 'VoteDelegateV3',
    createDelegate: {
      contract: 'DelegateFactoryV3',
      event: 'CreateVoteDelegate',
      params: { usr: DELEGATE_OWNER, voteDelegate: DELEGATE_CONTRACT },
    },
    lock: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegateV3', event: 'Lock', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
    free: (usr: Delegator, wad: bigint) =>
      ({ contract: 'VoteDelegateV3', event: 'Free', srcAddress: DELEGATE_CONTRACT, params: { usr, wad } }) as const,
  },
] as const;

describe.each(VERSIONS)('$version delegator count', ({ createDelegate, lock, free }) => {
  const DELEGATE_ID = `1-${DELEGATE_CONTRACT}`;

  const expectCountMatchesPositiveRows = async (indexer: ReturnType<typeof createTestIndexer>) => {
    const delegate = await indexer.Delegate.getOrThrow(DELEGATE_ID);
    const rows = (await indexer.Delegation.getAll()).filter(d => d.delegate_id === DELEGATE_ID);
    expect(delegate.delegators).toBe(rows.filter(d => d.amount > 0n).length);
    expect(delegate.totalDelegated).toBe(rows.reduce((sum, d) => sum + d.amount, 0n));
    return delegate;
  };

  it('ignores zero-value Lock and Free events', async () => {
    const indexer = createTestIndexer();
    const [attacker, holder] = DELEGATORS;

    await indexer.process({
      chains: {
        1: {
          simulate: [
            createDelegate,
            lock(holder, 100n),
            ...Array.from({ length: 5 }, () => lock(attacker, 0n)),
            ...Array.from({ length: 20 }, () => free(attacker, 0n)),
            lock(holder, 0n),
            free(holder, 0n),
          ],
        },
      },
    });

    const delegate = await expectCountMatchesPositiveRows(indexer);
    expect(delegate.delegators).toBe(1);
    expect(await indexer.Delegation.get(`${DELEGATE_ID}-${attacker}`)).toBeUndefined();
    const history = (await indexer.DelegationHistory.getAll()).filter(h => h.delegate_id === DELEGATE_ID);
    expect(history).toHaveLength(1);
  });

  it('keeps delegators equal to the number of positive delegations', async () => {
    // mulberry32, seeded so failures reproduce
    let seed = 0x5eed;
    const rand = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };

    const balances = new Map(DELEGATORS.map(d => [d, 0n]));
    const events = [];
    for (let i = 0; i < 200; i++) {
      const usr = DELEGATORS[rand(DELEGATORS.length)];
      const balance = balances.get(usr)!;
      const roll = rand(4);
      let wad: bigint;
      if (roll === 0) wad = 0n;
      else if (roll === 1) wad = balance;
      else wad = BigInt(rand(50) + 1);

      if (rand(2) === 0 || wad > balance) {
        events.push(lock(usr, wad));
        balances.set(usr, balance + wad);
      } else {
        events.push(free(usr, wad));
        balances.set(usr, balance - wad);
      }
    }

    const indexer = createTestIndexer();
    await indexer.process({ chains: { 1: { simulate: [createDelegate, ...events] } } });

    const delegate = await expectCountMatchesPositiveRows(indexer);
    expect(delegate.delegators).toBe([...balances.values()].filter(b => b > 0n).length);
  });
});
