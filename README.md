# ChainProof

> **A local-first digital evidence integrity and chain-of-custody demo.**

ChainProof combines SHA-256 file fingerprints, IPFS content addressing, and Ethereum-compatible smart contracts to record evidence and custody changes. A case-access portal and workspace let authorized users register evidence, compare files against on-chain fingerprints, and review custody activity.

**Project status:** educational MVP for local development. It is not a production evidence-management system and does not establish a file's authenticity before registration or its legal admissibility.

> [!CAUTION]
> IPFS content may be publicly retrievable. Never upload real, confidential, personal, or otherwise sensitive case material. Use synthetic demo files only. A matching SHA-256 fingerprint proves that the bytes match the registered fingerprint; it does not prove who originally created the file or whether it was trustworthy when registered.

## What it does

- **Register evidence:** hash a selected file with SHA-256, upload it through a configured backend IPFS provider, and record its digest and CID on-chain.
- **Verify integrity:** compare a local file's SHA-256 digest with the evidence record on the configured chain.
- **Track custody:** transfer custody through the smart contracts and review the resulting on-chain event history.
- **Protect case workspaces:** authenticate with a case ID and password; the frontend has no signup screen.
- **Associate records with cases:** use the backend and MongoDB to map authenticated cases to blockchain evidence.

## Architecture

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, ethers | Case access, evidence workflows, browser-side SHA-256, wallet interaction |
| Backend | Node.js, Express, TypeScript | Case authentication, session/API handling, IPFS uploads, MongoDB association |
| Smart contracts | Solidity, Foundry | Evidence registry and custody-transfer rules |
| Local chain | Anvil | Development Ethereum-compatible JSON-RPC network |
| Database | MongoDB | Case metadata, password hashes, and case-to-evidence associations |
| File storage | Pinata or local Kubo | IPFS upload provider; configure one to register evidence |

More detail, including component flows and contract invariants, is in [the architecture guide](docs/ARCHITECTURE.md). Contract-specific notes are in [the blockchain guide](blockchain/README.md).

## Requirements

- Windows, macOS, or Linux
- Node.js and npm
- [Foundry](https://getfoundry.sh/) (`anvil`, `forge`)
- MongoDB, running locally or at a URI you control
- MetaMask for browser wallet interactions
- A Pinata JWT or local Kubo API for actual IPFS uploads

The app can be explored without configuring IPFS, but evidence registration requires an upload provider. The default local chain is Anvil on `127.0.0.1:8545` with chain ID `31337`.

## Run locally

Commands below assume you run them from the repository root in PowerShell. Keep Anvil, the backend, and the frontend running in separate terminals.

### 1. Install dependencies

```powershell
cd backend
npm ci
cd ..\frontend
npm ci
cd ..
```

### 2. Start MongoDB and Anvil

Start MongoDB using your local installation or managed database. Then open a terminal and run:

```powershell
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

Anvil is for local development only. Its development accounts and keys must never be used on a public or production network.

### 3. Build, test, and deploy the contracts

In another terminal:

```powershell
cd blockchain
forge build
forge test
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --unlocked
cd ..
```

The deployment script deploys both contracts, wires them together, and prints their addresses. Copy those addresses into the backend and frontend environment files in the next step. Restarting Anvil clears its deployed contracts and data, so deploy again after a reset.

### 4. Configure local environment

Create local environment files from the examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Update the contract-address values in both files to match the deployment output. Check that the RPC URL and chain ID match your Anvil instance.

For evidence uploads, configure **one** provider in `backend\.env`:

- Pinata: set `PINATA_JWT`.
- Local Kubo: set `IPFS_API_URL`, for example `http://127.0.0.1:5001`.

Keep provider credentials in the backend environment only. Do not put secrets in `frontend\.env.local` or any `VITE_*` setting. The example session secret is for local development only; set a unique secret for any non-demo deployment.

### 5. Provision a demo case

The frontend has no signup screen. For a local demo, provision a case from the `backend` directory using a unique, non-sensitive demo password:

```powershell
cd backend
npm run provision:case -- CASE-DEMO-001 "<unique-local-demo-password>" "Synthetic demo case" "Demo Investigator"
```

Use synthetic case details only. Do not reuse personal or production credentials; command-line arguments may be saved in your shell history. The provisioning script does not print the password.

The backend also exposes case-creation API routes. Restrict or remove those routes before exposing the backend beyond a local demo if case creation is intended to be administrator-only.

### 6. Start the app

Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

The backend listens on `http://127.0.0.1:5000`; its health endpoint is `http://127.0.0.1:5000/api/health`.

Start the frontend in another terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Connect MetaMask to the local Anvil network and use the case ID and demo password you provisioned.

## Development checks

Run checks from the corresponding project directory:

```powershell
# Backend
cd backend
npm test
npm run build

# Frontend
cd ..\frontend
npm run lint
npm run build

# Smart contracts
cd ..\blockchain
forge test
```

## Repository layout

```text
ChainProof/
├── backend/       # Express API, case provisioning, and backend tests
├── blockchain/    # Foundry contracts, deployment script, and Solidity tests
├── docs/          # Architecture and technical documentation
├── frontend/      # React application
├── .gitignore
└── README.md
```

## Important limitations

- A blockchain record anchors the supplied fingerprint from registration onward; it cannot establish the file's provenance before registration.
- IPFS content addressing is not encryption or access control. A public CID can expose the uploaded content.
- Evidence identifiers, CIDs, hashes, wallet addresses, and chain activity are publicly visible on-chain. Files uploaded to a public IPFS network may also be retrieved by others; MongoDB case metadata is not written to the chain.
- The default setup is local development, not a production deployment. Review authentication, infrastructure, privacy, backups, key management, and operational procedures before using any real case data.
- Although the frontend has no signup page, backend case-creation endpoints are currently available; protect them before deploying the API publicly.

## License

No license is currently included. Unless a license is added, others do not automatically have permission to reuse, modify, or distribute this project. See the repository cleanup notes before publishing it publicly.
