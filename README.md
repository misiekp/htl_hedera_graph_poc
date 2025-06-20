# Hedera Graph Indexing Demo

This project demonstrates how to use The Graph to index and query data from a Hedera smart contract deployed on testnet. It includes a simple price feed contract, a subgraph configuration, and TypeScript scripts to interact with both the contract and the indexed data.

# Project Structure

```
.
├── contracts/             # Smart contract code
│   ├── abi/               # Folder where ABI file is stored
│   └── PriceFeed.sol      # Sample price feed contract
├── scripts/               # TypeScript scripts
│   ├── deploy.ts          # Contract deployment script
│   ├── update.ts          # Script to update prices
│   └── query-history.ts   # Script to query price history
├── subgraph/              # The Graph configuration
│   ├── schema.graphql     # GraphQL schema
│   ├── subgraph.yaml      # Subgraph manifest
│   ├── abis/              # Folder to put ABI fles
│   └── src/               # TypeScript sources
│      └── mapping.ts      # AssemblyScript mappings
├── graph-node/            # Local Graph Node configuration
├── package.json           # Node.js dependencies
└── tsconfig.json          # TypeScript configuration
└── .env.example           # .env file template
└── README.md              # This document
```

## Smart Contract

The sample contract (`PriceFeed.sol`) implements a simple price feed with events that can be indexed by The Graph. It includes:
- Price update events
- Basic price management functions

## Subgraph

The subgraph configuration includes:
- GraphQL schema definition
- Event mappings for price updates
- Contract ABI integration

## Scripts

Scripts are supporting:
- Deploying the smart contract on Hedera testnet, and updating the project's configuration
- Interacting with the smart contract to update the price records
- Querying local Graph node to see the price history

# Setup

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Hedera testnet account
- Solidity compiler installed
- An account with ECDSA private key on Hedera Testnet (accounts with ED25519 keys are not EVM compatibile)

#### Install project dependencies:
```bash
npm install
```

#### Configure your environment:
```bash
cp .env.example .env
```
Edit .env with your credentials:
```
HEDERA_OPERATOR_ID=[Your Hedera testnet account ID]
HEDERA_OPERATOR_KEY=[Your account's HEX Encoded Private Key]
CONTRACT_ID=[this will be edited after deploying the contract]
```

#### Build the contract and generatie ABI file
```bash
solc --abi contracts/PriceFeed.sol -o contracts/abi --overwrite
solc --bin contracts/PriceFeed.sol -o contracts --overwrite
```

#### Deploy the contract
```bash
npm run deploy
```

This will:
- Deploy the contract to Hedera testnet
- Update the subgraph configuration with the new contract address
- Provide the contract ID to be copied to the `.env` file

#### Add the deployed contract id to your environment:
Edit .env file:
```
HEDERA_OPERATOR_ID=[Your Hedera testnet account ID]
HEDERA_OPERATOR_KEY=[Your account's HEX Encoded Private Key]
CONTRACT_ID=[Contract ID provided by deploy.ts in the previous step]
```


#### Start the local Graph Node:
First, remove the .keep file from posdtgres data directory, as postgres requires a clean directory to initialize
```bash
rm graph-node/data/postgres/.keep
```

Then run the node
```bash
cd graph-node
docker compose up -d
cd ..
```
You can confirm, that the node is up by looking into docker logs and check indexing status using http://localhost:8030/graphql/playground

#### Deploy the subgraph
Copy the contract's ABI file:
```bash
cp contracts/abi/PriceFeed.abi subgraph/abis/
```

Deploy the subgraph:
```bash
cd subgraph
npx graph codegen
npx graph build
npx graph create --node http://localhost:8020 hedera-pricefeed-test
npx graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 hedera-pricefeed-test
cd ..
```

## Usage

#### Update Prices

To update a price for an asset:
```bash
npm run update -- --price=123456 --asset=BTC
```

Parameters:
- `--price`: Price in cents (default: 55000)
- `--asset`: Asset name (default: "BTC")

⚠️ **Note:** On Windows passing arguments by node does not work, you will need to run the script directly:
```
 ts-node scripts/update.ts --price=55000 --asset=BTC
```

#### Query Price History

To view the price history and indexing status:
```bash
npm run query
```

This will show:
- Current indexing status
- Latest indexed block with timestamp
- Chain head block with timestamp
- Price history grouped by asset

# License

MIT 

