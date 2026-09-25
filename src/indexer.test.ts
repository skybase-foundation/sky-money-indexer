import { describe, expect, it } from 'vitest';
import { createTestIndexer } from 'envio';
import './EventHandlers';
import { ZERO_ADDRESS } from './helpers/constants';
import { isRequestError } from './helpers/contractCalls';
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  HttpRequestError,
  type EIP1193RequestFn,
} from 'viem';
import { mainnet } from 'viem/chains';

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

  it.each([0x5eed, 1, 42, 999, 12345])('keeps delegators equal to the number of positive delegations (seed %i)', async (initialSeed) => {
    // mulberry32, seeded so failures reproduce
    let seed = initialSeed;
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

      // an over-free drives the stored amount negative, which production shows
      // happening when a Free is indexed without its matching Lock
      const overFree = rand(8) === 0;
      if (!overFree && (rand(2) === 0 || wad > balance)) {
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

describe('DSChiefV2 slates', () => {
  const VOTER = '0x5555555555555555555555555555555555555555';
  const SPELL_A = '0x6666666666666666666666666666666666666666';
  const SPELL_B = '0x7777777777777777777777777777777777777777';
  const SLATE = '0x7a7df2645617a7ced6deed4b73fc7c302fb40daab4d8a1849dfd93859ddff783';
  const EMPTY_SLATE = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

  // Seeding the spells keeps the Etch handler from reading them over RPC
  function seedSpells(indexer: ReturnType<typeof createTestIndexer>) {
    for (const address of [SPELL_A, SPELL_B]) {
      indexer.SpellV2.set({
        id: `1-${address}`,
        chainId: 1,
        address,
        description: '',
        state: 'ACTIVE',
        creationBlock: 1n,
        creationTime: 1n,
        expiryTime: 0n,
        totalVotes: 0n,
        totalWeightedVotes: 0n,
        castBlock: undefined,
        castTime: undefined,
        castTxnHash: undefined,
        castWith: undefined,
        liftedBlock: undefined,
        liftedTime: undefined,
        liftedTxnHash: undefined,
        liftedWith: undefined,
        scheduledBlock: undefined,
        scheduledTime: undefined,
        scheduledTxnHash: undefined,
      });
    }
  }

  it('builds the slate from Etch and records votes for each spell on it', async () => {
    const indexer = createTestIndexer();
    seedSpells(indexer);

    await indexer.process({
      chains: {
        1: {
          simulate: [
            { contract: 'DSChiefV2', event: 'Lock', params: { usr: VOTER, wad: 100n } },
            // vote(address[]) emits Etch and then Vote in the same transaction
            {
              contract: 'DSChiefV2',
              event: 'Etch',
              params: { slate: SLATE, yays: [ZERO_ADDRESS, SPELL_A, SPELL_B] },
            },
            { contract: 'DSChiefV2', event: 'Vote', params: { usr: VOTER, slate: SLATE } },
          ],
        },
      },
    });

    const slate = await indexer.SlateV2.getOrThrow(`1-${SLATE}`);
    expect(slate.yays).toEqual([`1-${SPELL_A}`, `1-${SPELL_B}`]);

    const voter = await indexer.Voter.getOrThrow(`1-${VOTER}`);
    expect(voter.currentSpellsV2).toEqual([`1-${SPELL_A}`, `1-${SPELL_B}`]);

    for (const spell of [SPELL_A, SPELL_B]) {
      const vote = await indexer.ExecutiveVoteV2.getOrThrow(`1-${spell}-${VOTER}`);
      expect(vote.weight).toBe(100n);
      expect((await indexer.SpellV2.getOrThrow(`1-${spell}`)).totalWeightedVotes).toBe(100n);
    }
  });

  it('keeps the original slate when it is etched again', async () => {
    const indexer = createTestIndexer();
    seedSpells(indexer);

    await indexer.process({
      chains: {
        1: {
          simulate: [
            { contract: 'DSChiefV2', event: 'Etch', block: { number: 10 }, params: { slate: SLATE, yays: [SPELL_A] } },
            { contract: 'DSChiefV2', event: 'Etch', block: { number: 20 }, params: { slate: SLATE, yays: [SPELL_A] } },
          ],
        },
      },
    });

    const slate = await indexer.SlateV2.getOrThrow(`1-${SLATE}`);
    expect(slate.creationBlock).toBe(10n);
  });

  it('handles a vote for the empty slate, which is never etched', async () => {
    const indexer = createTestIndexer();
    seedSpells(indexer);

    await indexer.process({
      chains: {
        1: {
          simulate: [
            { contract: 'DSChiefV2', event: 'Lock', params: { usr: VOTER, wad: 100n } },
            { contract: 'DSChiefV2', event: 'Etch', params: { slate: SLATE, yays: [SPELL_A] } },
            { contract: 'DSChiefV2', event: 'Vote', params: { usr: VOTER, slate: SLATE } },
            { contract: 'DSChiefV2', event: 'Vote', params: { usr: VOTER, slate: EMPTY_SLATE } },
          ],
        },
      },
    });

    expect((await indexer.SlateV2.getOrThrow(`1-${EMPTY_SLATE}`)).yays).toEqual([]);
    expect((await indexer.Voter.getOrThrow(`1-${VOTER}`)).currentSpellsV2).toEqual([]);
    expect((await indexer.SpellV2.getOrThrow(`1-${SPELL_A}`)).totalWeightedVotes).toBe(0n);
  });

  it('fails instead of recording an empty vote when the slate was never etched', async () => {
    const indexer = createTestIndexer();

    // The handler error stops the indexer, which surfaces here as the worker exiting
    await expect(
      indexer.process({
        chains: {
          1: {
            simulate: [{ contract: 'DSChiefV2', event: 'Vote', params: { usr: VOTER, slate: SLATE } }],
          },
        },
      }),
    ).rejects.toThrow();
  });
});

describe('isRequestError', () => {
  const spellAbi = [
    { name: 'expiration', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'description', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  ] as const;

  // Reads through a stubbed transport, directly or batched through multicall3
  // like the indexer's clients, and returns the error viem raises
  async function readError(
    functionName: 'expiration' | 'description',
    request: EIP1193RequestFn,
    multicall: boolean,
  ): Promise<unknown> {
    const client = createPublicClient({
      chain: mainnet,
      batch: multicall ? { multicall: true } : undefined,
      transport: custom({ request }, { retryCount: 0 }),
    });
    try {
      await client.readContract({ address: '0x1111111111111111111111111111111111111111', abi: spellAbi, functionName });
    } catch (error) {
      return error;
    }
    throw new Error('expected the read to fail');
  }

  // eth_call answer for a call that succeeds with `data`, or reverts in the multicall case
  const returns = (data: `0x${string}`, multicall: boolean, success = true) =>
    (async () =>
      multicall
        ? encodeAbiParameters(
            [{ type: 'tuple[]', components: [{ type: 'bool' }, { type: 'bytes' }] }],
            [[[success, data]]],
          )
        : data) as unknown as EIP1193RequestFn;

  describe.each([false, true])('multicall: %s', multicall => {
    it('treats data that does not decode as the contract answering', async () => {
      expect(isRequestError(await readError('expiration', returns('0x01', multicall), multicall))).toBe(false);
      expect(
        isRequestError(await readError('description', returns(`0x${'ff'.repeat(32)}`, multicall), multicall)),
      ).toBe(false);
    });

    it('treats an empty return as the contract answering', async () => {
      expect(isRequestError(await readError('expiration', returns('0x', multicall), multicall))).toBe(false);
    });

    it('treats a failed HTTP request as a request error', async () => {
      const request = (async () => {
        throw new HttpRequestError({ url: 'https://rpc', status: 503 });
      }) as unknown as EIP1193RequestFn;
      expect(isRequestError(await readError('expiration', request, multicall))).toBe(true);
    });

    it('treats a JSON-RPC error such as a rate limit as a request error', async () => {
      const request = (async () => {
        throw { code: -32005, message: 'limit exceeded' };
      }) as unknown as EIP1193RequestFn;
      expect(isRequestError(await readError('expiration', request, multicall))).toBe(true);
    });
  });

  it('treats a reverted multicall sub-call as the contract answering', async () => {
    expect(isRequestError(await readError('expiration', returns('0x', true, false), true))).toBe(false);
  });

  it('treats an error viem did not raise as a request error', () => {
    expect(isRequestError(new Error('No RPC client configured for chain 5'))).toBe(true);
  });
});

