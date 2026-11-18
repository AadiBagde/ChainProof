# ChainProof — blockchain

Foundry project with exactly two Solidity contracts:

- `src/EvidenceRegistry.sol` — evidence metadata, SHA-256 digest, IPFS CID, current custodian
- `src/CustodyManager.sol` — custodian-only transfers; emits history events

Solidity `0.8.20`. The stored `fileHash` is a caller-supplied **SHA-256** digest (`bytes32`). Contracts do not hash files and do not treat `keccak256` as the file fingerprint.

## Input limits

| Field | Rule |
| --- | --- |
| Evidence ID | 1–64 bytes; unique |
| IPFS CID | 1–128 bytes |
| Description | 0–256 bytes (empty allowed) |
| File hash | 32-byte SHA-256 digest; not `bytes32(0)` |
| Custodian / recipient | Non-zero address; transfer cannot target the current custodian |

Unregistered IDs have no record (`exists == false`). The only status value is `Registered`.

Custody manager wiring is a **one-time** owner call to `setCustodyManager`. After that, the address cannot be replaced.

On-chain metadata and events are public to anyone using the local chain. Do not store passphrases, private keys, or IPFS secrets in these contracts.

## Commands

From this directory, with Foundry installed and its commands available in `PATH`:

```text
forge build
forge test -vv
```

## Local deployment (Phase 3)

### Prerequisites

- Anvil (`anvil`) running locally.
- No MetaMask or real funds needed — Anvil provides funded development accounts.

### Step 1 — Start Anvil

Open a dedicated terminal and keep it running:

```text
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

Anvil prints 10 pre-funded accounts and their private keys. Use any of them
for local development. **Never use these keys outside a local dev environment.**

### Step 2 — Deploy both contracts

In a second terminal, from `Team7\ChainProof\blockchain`:

```text
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --unlocked
```

`--unlocked` tells Forge to sign with any Anvil account without supplying a
private key in the command or in source code. **Never use `--unlocked` on a
real network.**

The script:
1. Deploys `EvidenceRegistry`.
2. Deploys `CustodyManager` with the registry address.
3. Calls `EvidenceRegistry.setCustodyManager()` (one-time owner wiring).
4. Verifies both sides of the wiring with on-chain reads.
5. Prints the deployed addresses and the exact `frontend/.env.local` lines.

### Step 3 — Verify with cast (optional manual check)

```text
cast call <REGISTRY_ADDRESS> "custodyManager()(address)" --rpc-url http://127.0.0.1:8545
cast call <MANAGER_ADDRESS> "registry()(address)" --rpc-url http://127.0.0.1:8545
```

Both calls must return the counterpart address.

### Step 4 — Record addresses for the frontend

Copy the lines printed by the script into `frontend/.env.local` (not tracked by Git):

```text
VITE_EVIDENCE_REGISTRY_ADDRESS=<address from script output>
VITE_CUSTODY_MANAGER_ADDRESS=<address from script output>
VITE_CHAIN_ID=31337
```

See `frontend/.env.example` for all required variable names and placeholders.

### Important: Anvil state is ephemeral

Stopping or resetting Anvil erases all deployed contracts and transactions.
Rerun the deploy script after every fresh Anvil start.
The addresses will differ each time only if Anvil is reset with a different
nonce state; with a clean start they are deterministic for the same deployer.

## Broadcast artifacts

Forge saves the on-chain transaction receipts to:

```text
blockchain/broadcast/Deploy.s.sol/31337/run-latest.json
```

This file is in `.gitignore`. Do not commit it; it may contain deployment
account information and will change every run.

## Third contract policy

Do not add a third contract without explicit team approval. The architecture
specifies exactly `EvidenceRegistry.sol` and `CustodyManager.sol`.
