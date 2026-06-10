import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const servers = {
  library: {
    name: "library-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/library/index.js"),
    testTool: "search_books",
    testArgs: { query: "clean code" }
  },
  cafeteria: {
    name: "cafeteria-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/cafeteria/index.js"),
    testTool: "get_specials",
    testArgs: {}
  },
  events: {
    name: "events-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/events/index.js"),
    testTool: "list_events",
    testArgs: {}
  },
  academics: {
    name: "academics-mcp-server",
    path: path.resolve(__dirname, "../mcp-servers/academics/index.js"),
    testTool: "get_course_details",
    testArgs: { courseId: "CS101" }
  }
};

async function runTests() {
  console.log("=== STARTING CAMPUS INTEL MCP VERIFICATION ===");
  
  let allPassed = true;

  for (const [key, config] of Object.entries(servers)) {
    console.log(`\nTesting server: ${config.name}...`);
    let client, transport;
    
    try {
      transport = new StdioClientTransport({
        command: "node",
        args: [config.path]
      });

      client = new Client(
        { name: `test-client-to-${key}`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      console.log(`✔ Connected successfully to ${config.name}`);

      // List Tools
      const listRes = await client.listTools();
      console.log(`✔ Retrieved tools list: ${listRes.tools.map(t => t.name).join(", ")}`);

      // Call Test Tool
      console.log(`Calling test tool '${config.testTool}'...`);
      const callRes = await client.callTool({
        name: config.testTool,
        arguments: config.testArgs
      });

      console.log(`✔ Call result content type: ${callRes.content[0].type}`);
      const text = callRes.content[0].text;
      console.log(`✔ Sample Output: ${text.substring(0, 150)}...`);

    } catch (err) {
      console.error(`❌ Test failed for server ${config.name}:`, err);
      allPassed = false;
    } finally {
      if (transport) {
        try {
          await transport.close();
          console.log(`✔ Closed connection to ${config.name}`);
        } catch (e) {}
      }
    }
  }

  console.log("\n==============================================");
  if (allPassed) {
    console.log("🏆 ALL MCP SERVER CHECKS PASSED!");
    process.exit(0);
  } else {
    console.log("🔴 SOME MCP SERVER CHECKS FAILED. PLEASE CHECK LOGS.");
    process.exit(1);
  }
}

runTests();
