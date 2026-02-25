/**
 * Main entry point for all Envio/HyperIndex event handlers.
 *
 * Each handler file registers its own handlers via the
 * ContractName.EventName.handler() and ContractName.EventName.contractRegister() APIs.
 * This file simply imports all handler modules to ensure they are registered.
 */

// === Token Conversions ===
import './dai-usds';
import './mkr-sky';
import './mkr-sky-v2';

// === Savings & Staking ===
import './savings-usds';
import './stusds';

// === Rewards ===
import './rewards';

// === PSM ===
import './psm3';

// === Curve ===
import './curveUsdsStUsdsPool';

// === Delegate Factories (register dynamic contracts) ===
import './delegate-factory';
import './delegate-factory-v2';
import './delegate-factory-v3';

// === Dynamic Vote Delegate Templates ===
import './vote-delegate';
import './vote-delegate-v2';
import './vote-delegate-v3';

// === Lockstake / Seal ===
import './seal';
import './lockstake-clipper';
import './lockstake-mkr';
import './lockstake-migrator';

// === Staking Engine ===
import './staking-engine';

// === Liquidations ===
import './mcd-dog';

// === Governance (DSChief LogNote is anonymous - may not work with HyperSync) ===
import './ds-chief';
import './ds-chief-v2';
import './polling-emitter';
import './arbitrum-polling';
