import { AccountId, ContractCreateFlow, PrivateKey, Client, TransactionResponse } from "@hashgraph/sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {

    if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
        throw new Error("Missing required environment variables. Please check your .env file.");
    }

    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
    const privateKeyString = process.env.HEDERA_OPERATOR_KEY;
    
    const operatorKey = privateKeyString.startsWith('0x') 
        ? PrivateKey.fromStringECDSA(privateKeyString.slice(2))
        : PrivateKey.fromStringECDSA(privateKeyString);

    const client = new Client({ network: { "0.testnet.hedera.com:50211": "0.0.3" } });
    client.setOperator(operatorId, operatorKey);

    const contractPath = path.join(__dirname, "../contracts/PriceFeed.bin");
    const bytecode = fs.readFileSync(contractPath, "utf8");

    console.log("Deploying contract...");

    const contractCreate = new ContractCreateFlow()
        .setGas(4000000)
        .setBytecode(bytecode);

    try {
        console.log("Executing transaction...");
        const txResponse = await Promise.race([
            contractCreate.execute(client),
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

        if (receipt.status.toString() !== "SUCCESS") {
            console.error("Transaction failed with status:", receipt.status.toString());
            process.exit(1);
        }

        const newContractId = receipt.contractId;
        if (!newContractId) {
            console.error("No contract ID in receipt");
            process.exit(1);
        }

        const record = await txResponse.getRecord(client);
        const consensusTimestamp = record.consensusTimestamp.toString();
        const creationTime = new Date(parseFloat(consensusTimestamp) * 1000).toLocaleString();
        const evmAddress = `0x${newContractId.toSolidityAddress()}`;


        console.log("\nContract deployed successfully!");
        console.log("Contract ID:", newContractId.toString());

        console.log("\nQuerying mirror node for block information...");
        const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/blocks?timestamp=gte:${consensusTimestamp}&order=asc&limit=1`;
        const response = await fetch(mirrorNodeUrl);
        const data = await response.json();
        
        if (data.blocks && data.blocks.length > 0) {
            const block = data.blocks[0];

            const subgraphYamlPath = path.join(__dirname, "../subgraph/subgraph.yaml");
            let subgraphYaml = fs.readFileSync(subgraphYamlPath, "utf8");
            
            subgraphYaml = subgraphYaml.replace(
                /startBlock:.*/,
                `startBlock: ${block.number}`
            );
            
            subgraphYaml = subgraphYaml.replace(
                /address:.*/,
                `address: "${evmAddress}"`
            );
            
            fs.writeFileSync(subgraphYamlPath, subgraphYaml);
            console.log("Updated subgraph.yaml with:");
            console.log("- Start Block:", block.number);
            console.log("- Contract Address:", evmAddress);
        } else {
            console.log("\nBlock information not found for timestamp:", consensusTimestamp);
        }

        
        const envPath = path.join(__dirname, "../.env");
        let envContent = fs.readFileSync(envPath, "utf8");
        
        if (envContent.includes("CONTRACT_ID=")) {
            envContent = envContent.replace(
                /CONTRACT_ID=.*/,
                `CONTRACT_ID=${newContractId?.toString()}`
            );
        } else {
            envContent += `\nCONTRACT_ID=${newContractId?.toString()}`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log("Updated .env file with new contract ID");

        process.exit(0);
    } catch (error) {
        console.error("Error during transaction execution:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 