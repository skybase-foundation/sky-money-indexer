# DISCLAIMER

THIS sky-money-indexer SOFTWARE CODE REPOSITORY (“REPOSITORY”) IS MADE AVAILABLE TO YOU BY JETSTREAMGG (“DEVELOPER”). WHILE DEVELOPER GENERATED THE OPEN-SOURCE CODE WITHIN THIS REPOSITORY, DEVELOPER DOES NOT MAINTAIN OR OPERATE ANY SOFTWARE PROTOCOL, PLATFORM, PRODUCT OR SERVICE THAT INCORPORATES SUCH SOURCE CODE.

DEVELOPER MAY, FROM TIME TO TIME, GENERATE, MODIFY AND/OR UPDATE SOURCE CODE WITHIN THIS REPOSITORY BUT IS UNDER NO OBLIGATION TO DO SO. HOWEVER, DEVELOPER WILL NOT PERFORM REPOSITORY MANAGEMENT FUNCTIONS, SUCH AS REVIEWING THIRD-PARTY CONTRIBUTIONS, MANAGING COMMUNITY INTERACTIONS OR HANDLING NON-CODING ADMINISTRATIVE TASKS.

THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY IS OFFERED ON AN “AS-IS,” “AS-AVAILABLE” BASIS WITHOUT ANY REPRESENTATIONS, WARRANTIES OR GUARANTEES OF ANY KIND, EITHER EXPRESS OR IMPLIED. DEVELOPER DISCLAIMS ANY AND ALL LIABILITY FOR ANY ISSUES THAT ARISE FROM THE USE, MODIFICATION OR DISTRIBUTION OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY. PLEASE REVIEW, TEST AND AUDIT ANY SOURCE CODE PRIOR TO MAKING USE OF SUCH SOURCE CODE. BY ACCESSING OR USING ANY SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY, YOU UNDERSTAND, ACKNOWLEDGE AND AGREE TO THE RISKS OF USING THE SOURCE CODE AND THE LIMITED SCOPE OF DEVELOPER’S ROLE AS DESCRIBED HEREIN. YOU AGREE THAT YOU WILL NOT HOLD DEVELOPER LIABLE OR RESPONSIBLE FOR ANY LOSSES OR DAMAGES ARISING FROM YOUR USE OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY.

# Reservation of trademark rights

The materials in this repository may include references to our trademarks as well as trademarks owned by other persons. No rights are granted to you to use any trade names, trademarks, service marks, or product names, whether owned by us or by others, except solely as necessary for reasonable and customary use in describing the origin of the source materials. All trademark rights are expressly reserved by the respective owners.

# Sky.money indexer

Built with [Envio HyperIndex](https://docs.envio.dev/docs/HyperIndex/overview), a real-time blockchain indexing framework. Uses [HyperSync](https://docs.envio.dev/docs/HyperSync/overview) for fast data retrieval across supported networks.

## Supported Networks

- Ethereum Mainnet
- Base
- Optimism
- Arbitrum
- Unichain
- Tenderly Testnet (via RPC fallback)

## Requirements

- Node.js
- [pnpm](https://pnpm.io/)
- Docker (for local development)

## Setup

Install dependencies:

```bash
pnpm install
```

Copy the environment sample and fill in the required values:

```bash
cp .env.sample .env
```

Environment variables:

- `ENVIO_API_TOKEN` - Required for HyperSync
- `MAINNET_RPC_URL`, `BASE_RPC_URL`, `OPTIMISM_RPC_URL`, `ARBITRUM_RPC_URL`, `UNICHAIN_RPC_URL` - RPC URLs for contract read calls

## Development

Generate types from `config.yaml`:

```bash
pnpm codegen
```

Start the local development indexer (runs Docker services for Postgres and Hasura GraphQL):

```bash
pnpm dev
```

The local Hasura GraphQL explorer is available at `http://localhost:8080` once running.

Stop the indexer:

```bash
pnpm stop
```

## Testing

```bash
pnpm test
```

## Project Structure

```
├── config.yaml          # Envio indexer configuration (contracts, networks, events)
├── schema.graphql       # GraphQL schema definitions
├── src/
│   ├── EventHandlers.ts # Main entry point - imports all handler modules
│   ├── helpers/         # Utility functions, constants, contract calls
│   └── *.ts             # Event handler modules by domain
├── abis/                # Contract ABIs
├── generated/           # Auto-generated code (do not edit)
│   ├── src/             # Generated TypeScript & ReScript runtime
│   └── docker-compose.yaml
└── tests/
```

## Adding a New Reward Contract

Add a new contract definition in `config.yaml` with the reward event signatures and reference the shared handler:

```yaml
- name: RewardsNewReward
  handler: src/EventHandlers.ts
  abi_file_path: abis/rewards/RewardsNewReward.json
  events:
    - event: 'RewardClaim(address indexed user, uint256 amount)'
    - event: 'Supplied(address indexed owner, uint256 assets)'
    - event: 'Withdrawn(address indexed owner, uint256 assets)'
```

Then add the contract addresses and start blocks for each network under the `networks` section, and ensure the handler logic in `src/rewards.ts` covers the new contract.

## Adding a New Network

To add support for a new blockchain network:

1. Add a new entry under the `networks` section in `config.yaml` with the network ID, HyperSync or RPC configuration, start block, and contract addresses.
2. If the network requires contract read calls, add the corresponding RPC URL environment variable to `.env`.
