import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Load environment variables
const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

// Define types
interface PriceUpdate {
    id: string;
    asset: string;
    price: string;
    timestamp: string;
    transactionHash: string;
}

interface Block {
    number: string;
    hash: string;
}

interface Chain {
    chainHeadBlock: Block;
    latestBlock: Block;
}

interface IndexingStatus {
    subgraph: string;
    synced: boolean;
    health: string;
    fatalError: {
        message: string;
    } | null;
    chains: Chain[];
}

interface PriceUpdatesResponse {
    priceUpdates: PriceUpdate[];
}

interface IndexingStatusResponse {
    indexingStatuses: IndexingStatus[];
}

interface SubgraphInfo {
    id: string;
}

interface SubgraphInfoResponse {
    subgraph: SubgraphInfo;
}

interface BlockInfo {
    count: number;
    hapi_version: string;
    hash: string;
    name: string;
    number: number;
    previous_hash: string;
    size: number;
    timestamp: {
        from: string;
        to: string;
    };
    gas_used: number;
    logs_bloom: string;
}

// GraphQL queries
const PRICE_UPDATES_QUERY = gql`
  {
    priceUpdates(
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      asset
      price
      timestamp
      transactionHash
    }
  }
`;

const INDEXING_STATUS_QUERY = gql`
  {
    indexingStatuses {
      subgraph
      synced
      health
      fatalError {
        message
      }
      chains {
        chainHeadBlock {
          number
        }
        latestBlock {
          number
        }
      }
    }
  }
`;

// Helper function to convert bytes32 to string
function bytes32ToString(bytes32: string): string {
    // Remove '0x' prefix if present
    const hex = bytes32.startsWith('0x') ? bytes32.slice(2) : bytes32;
    // Convert hex to string, removing trailing zeros
    return Buffer.from(hex, 'hex').toString().replace(/\0+$/, '');
}

async function getBlockTimestamp(blockNumber: string): Promise<string> {
    try {
        const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/blocks/${blockNumber}`);
        const data = await response.json() as BlockInfo;
        const timestamp = parseFloat(data.timestamp.to);
        return new Date(timestamp * 1000).toLocaleString();
    } catch (error) {
        console.error(`Error fetching block ${blockNumber} timestamp:`, error);
        return 'Unknown';
    }
}

async function main() {
    // Create GraphQL clients
    const subgraphClient = new GraphQLClient('http://localhost:8000/subgraphs/name/hedera-pricefeed-test');
    const statusClient = new GraphQLClient('http://localhost:8030/graphql');

    try {
        // Fetch indexing status
        const statusData = await statusClient.request<IndexingStatusResponse>(INDEXING_STATUS_QUERY);
        
        // Display all subgraph statuses
        console.log('\nGraph Node Indexing Status:');
        console.log('----------------------------------------');
        
        for (const status of statusData.indexingStatuses) {
            console.log('\nSubgraph:', status.subgraph);
            console.log('Synced:', status.synced);
            console.log('Health:', status.health);
            
            if (status.fatalError) {
                console.log('Fatal Error:', status.fatalError.message);
            }

            const chain = status.chains[0];
            if (chain) {
                console.log('\nBlock Information:');
                console.log('----------------------------------------');
                console.log('Latest Indexed Block:');
                const latestBlockTimestamp = await getBlockTimestamp(chain.latestBlock.number);
                console.log('  Number:', chain.latestBlock.number);
                console.log('  Timestamp:', latestBlockTimestamp);
                console.log('\nChain Head Block:');
                const headBlockTimestamp = await getBlockTimestamp(chain.chainHeadBlock.number);
                console.log('  Number:', chain.chainHeadBlock.number);
                console.log('  Timestamp:', headBlockTimestamp);
                
                // Calculate blocks behind
                const blocksBehind = parseInt(chain.chainHeadBlock.number) - parseInt(chain.latestBlock.number);
                console.log('\nBlocks Behind:', blocksBehind);
            }
        }

        // Fetch price updates
        const priceData = await subgraphClient.request<PriceUpdatesResponse>(PRICE_UPDATES_QUERY);
        
        // Group updates by asset
        const groupedUpdates = priceData.priceUpdates.reduce((acc: { [key: string]: PriceUpdate[] }, update: PriceUpdate) => {
            const asset = bytes32ToString(update.asset);
            if (!acc[asset]) {
                acc[asset] = [];
            }
            acc[asset].push(update);
            return acc;
        }, {});

        // Display results
        console.log('\nPrice History by Asset:\n');
        
        for (const [asset, updates] of Object.entries(groupedUpdates)) {
            console.log(`\n${asset}:`);
            console.log('----------------------------------------------------------------------------------------------------------');
            console.log('Timestamp'.padEnd(25) + 'Price'.padEnd(15) + 'Transaction Hash');
            console.log('----------------------------------------------------------------------------------------------------------');
            
            updates.forEach((update: PriceUpdate) => {
                const date = new Date(parseInt(update.timestamp) * 1000).toLocaleString();
                const price = update.price;
                const txHash = update.transactionHash;
                console.log(
                    date.padEnd(25) + 
                    price.padEnd(15) + 
                    txHash
                );
            });
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 