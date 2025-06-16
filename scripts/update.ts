import { Client, ContractExecuteTransaction, ContractId, Hbar, ContractFunctionParameters, PrivateKey, TransactionResponse } from "@hashgraph/sdk";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file in the root directory
const envPath = path.resolve(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env file:", result.error);
    console.error("Please ensure you have a .env file in the root directory with the following variables:");
    console.error("HEDERA_OPERATOR_ID=your_account_id");
    console.error("HEDERA_OPERATOR_KEY=your_private_key");
    console.error("CONTRACT_ID=your_contract_id");
    process.exit(1);
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hexString: string): Uint8Array {
    // Remove '0x' prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

// Helper function to convert string to bytes32
function stringToBytes32(str: string): Uint8Array {
    // Check if string is too long
    if (str.length > 32) {
        throw new Error("Asset name must be 32 characters or less");
    }
    
    // Create a 32-byte array filled with zeros
    const bytes = new Uint8Array(32);
    
    // Convert string to bytes and copy to the array
    const encoder = new TextEncoder();
    const strBytes = encoder.encode(str);
    bytes.set(strBytes);
    
    return bytes;
}

// Parse command line arguments
function parseArgs(): { price: number; asset: string } {
    const args = process.argv.slice(2);
    const priceArg = args.find(arg => arg.startsWith('--price='));
    const assetArg = args.find(arg => arg.startsWith('--asset='));
    
    const price = priceArg ? parseInt(priceArg.split('=')[1]) : 55000;
    const asset = assetArg ? assetArg.split('=')[1] : "BTC";
    
    if (isNaN(price)) {
        console.error("Invalid price value. Please provide a valid number.");
        process.exit(1);
    }
    
    if (asset.length > 32) {
        console.error("Asset name must be 32 characters or less.");
        process.exit(1);
    }
    
    return { price, asset };
}

async function main() {
    const { price, asset } = parseArgs();
    console.log(`Starting transaction with asset: ${asset}, price: ${price}`);
    
    // Create Hedera client
    const client = Client.forTestnet();
    console.log("Created Hedera client");
    
    // Check for required environment variables
    const requiredEnvVars = {
        HEDERA_OPERATOR_ID: process.env.HEDERA_OPERATOR_ID,
        HEDERA_OPERATOR_KEY: process.env.HEDERA_OPERATOR_KEY,
        CONTRACT_ID: process.env.CONTRACT_ID
    };

    const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        console.error("Missing required environment variables:");
        missingVars.forEach(varName => console.error(`- ${varName}`));
        console.error("\nPlease ensure these variables are set in your .env file.");
        process.exit(1);
    }
    
    // Try to create private key
    let operatorPrivateKey: PrivateKey;
    try {
        const privateKeyString = process.env.HEDERA_OPERATOR_KEY!;
        // Remove '0x' prefix if present and use fromStringECDSA
        const cleanKey = privateKeyString.startsWith('0x') ? privateKeyString.slice(2) : privateKeyString;
        operatorPrivateKey = PrivateKey.fromStringECDSA(cleanKey);
        console.log("Successfully created private key");
    } catch (error) {
        console.error("Error creating private key. Please ensure your private key is in the correct format.");
        console.error("It should be a hex-encoded ECDSA private key (with or without '0x' prefix).");
        throw error;
    }

    console.log("Using operator ID:", process.env.HEDERA_OPERATOR_ID);
    console.log("Using contract ID:", process.env.CONTRACT_ID);

    client.setOperator(
        process.env.HEDERA_OPERATOR_ID!,
        operatorPrivateKey
    );
    console.log("Set operator on client");

    // Get contract ID from file
    const contractId = ContractId.fromString(process.env.CONTRACT_ID!);
    console.log("Created contract ID object");

    // Convert asset name to bytes32
    const assetBytes32 = stringToBytes32(asset);
    console.log(`Converted asset name "${asset}" to bytes32`);

    // Create transaction to update price
    const transaction = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(300000)
        .setPayableAmount(new Hbar(0))
        .setFunction(
            "updatePrice",
            new ContractFunctionParameters()
                .addBytes32(assetBytes32)
                .addUint256(price) // price in cents
        );
    console.log("Created transaction");

    try {
        // Sign and execute the transaction with timeout
        console.log("Executing transaction...");
        const txResponse = await Promise.race([
            transaction.execute(client),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Transaction execution timed out after 30 seconds")), 30000)
            )
        ]) as TransactionResponse;
        console.log("Transaction executed, getting receipt...");
        
        const receipt = await Promise.race([
            txResponse.getReceipt(client),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Getting receipt timed out after 30 seconds")), 30000)
            )
        ]);

        console.log("Transaction status:", receipt.status.toString());
        console.log("Transaction ID:", txResponse.transactionId.toString());
        
        
        // Exit successfully
        process.exit(0);
    } catch (error) {
        console.error("Error during transaction execution:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
}); 