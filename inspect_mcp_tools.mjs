
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from 'fs';

let env = "";
try {
    env = fs.readFileSync('.env.temp', 'utf-8');
    env = env.replace(/[^\x20-\x7E\n\r]/g, '');
} catch (e) { process.exit(1); }

const tokenMatch = env.match(/FIGMA_ACCESS_TOKEN=(.*)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';

process.env.FIGMA_API_KEY = token;
process.env.figmaApiKey = token;
process.env.STDIO = "true";

const transport = new StdioClientTransport({
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ["-y", "@smithery/cli@latest", "run", "--config", "{}", "@smithery/figma-context-mcp"]
});

const client = new Client({ name: "inspector", version: "1.0.0" }, { capabilities: { tools: {} } });

async function main() {
    try {
        await client.connect(transport);
        const response = await client.listTools();
        console.log("TOOLS LIST:");
        response.tools.forEach(t => {
            console.log(`- ${t.name}: ${t.description}`);
        });
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}
main();
