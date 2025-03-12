import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPUploadThing } from "./mcp.js";

const token = process.env.UPLOADTHING_TOKEN;

async function main() {
  if (!token) {
    throw new Error("UPLOADTHING_TOKEN is required");
  }

  const { mcpServer } = createMCPUploadThing({
    token,
  });
  const transport = new StdioServerTransport();

  // Connect the server to stdio transport
  await mcpServer.connect(transport);

  console.error("Uploadthing MCP Server running on stdio");
}
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
