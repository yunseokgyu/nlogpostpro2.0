
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from 'fs';
import path from 'path';

// Load credentials
let env = "";
try {
    env = fs.readFileSync('.env.temp', 'utf-8');
    env = env.replace(/[^\x20-\x7E\n\r]/g, ''); // Clean non-printing chars
} catch (e) {
    console.error("Could not read .env.temp");
    process.exit(1);
}

const tokenMatch = env.match(/FIGMA_ACCESS_TOKEN=(.*)/);
const keyMatch = env.match(/FIGMA_FILE_KEY=(.*)/);

const FIGMA_ACCESS_TOKEN = tokenMatch ? tokenMatch[1].trim() : '';
const FIGMA_FILE_KEY = keyMatch ? keyMatch[1].trim() : '';

if (!FIGMA_ACCESS_TOKEN || !FIGMA_FILE_KEY) {
    console.error("Missing credentials");
    process.exit(1);
}

// Set environment variables for the child process
process.env.FIGMA_API_KEY = FIGMA_ACCESS_TOKEN;
process.env.figmaApiKey = FIGMA_ACCESS_TOKEN;
process.env.STDIO = "true";

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const transport = new StdioClientTransport({
    command: command,
    args: [
        "-y",
        "@smithery/cli@latest",
        "run",
        "--config",
        "{}",
        "@smithery/figma-context-mcp"
    ]
});

const client = new Client({
    name: "figma-client",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {}
    }
});

async function main() {
    try {
        console.log("Connecting to server...");
        await client.connect(transport);
        console.log("Connected.");

        console.log("Listing tools...");
        const response = await client.listTools();
        console.log("Available tools:", response.tools.map(t => t.name));

        const fileTool = response.tools.find(t =>
            t.name.includes("file") ||
            t.name.includes("node") ||
            t.name.includes("structure")
        );

        if (fileTool) {
            console.log(`Found tool: ${fileTool.name}`);

            const schema = fileTool.inputSchema;
            const args = {};
            if (schema.properties) {
                if (schema.properties.file_key || schema.properties.fileKey) {
                    args[schema.properties.file_key ? 'file_key' : 'fileKey'] = FIGMA_FILE_KEY;
                }
            }

            console.log("Calling tool with args:", args);
            const result = await client.callTool({
                name: fileTool.name,
                arguments: args
            });
            fs.writeFileSync('figma_design.json', JSON.stringify(result, null, 2));
            console.log("Design data saved to figma_design.json");

        } else {
            console.error("No relevant tool found in:", response.tools.map(t => t.name));
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

main();
