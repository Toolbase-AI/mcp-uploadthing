import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UTApi } from "uploadthing/server";
import * as fs from "node:fs/promises";
import { z } from "zod";
import { File } from "node:buffer";

/**
 * Creates an MCP server with UploadThing integration
 */
export function createMCPUploadThing({ token }: { token: string }) {
  if (!token) {
    throw new Error("UploadThing Token is required");
  }

  // Create the MCP server
  const mcpServer = new McpServer({
    name: "mcp-uploadthing",
    version: "0.0.1",
  });

  // Create UploadThing API client
  const utapi = new UTApi({
    token,
  });

  // Add the upload file tool
  mcpServer.tool(
    "upload-file",
    "Upload file to UploadThing. Given a file path, it will upload the file to UploadThing and return the URL of the uploaded file.",
    {
      file: z.string().describe("Path to file to upload"),
      fileName: z.string().describe("Name of the file to upload"),
      fileType: z
        .string()
        .describe(
          "MIME type of the file (e.g., 'image/jpeg', 'application/pdf')"
        ),
    },
    async (params) => {
      try {
        // Read the file from the provided path
        const buffer = await fs.readFile(params.file);

        // Create a File object using Node.js 22's native File API
        const fileObj = new File([buffer], params.fileName, {
          type: params.fileType,
        });

        try {
          // Upload the file using UploadThing API
          // Note: The uploadFiles method expects a FileEsque object or array
          const result = await utapi.uploadFiles(fileObj);

          if (result.error) {
            throw new Error(`Upload failed: ${JSON.stringify(result.error)}`);
          }

          return {
            content: [
              {
                type: "text",
                text: `File uploaded successfully: ${JSON.stringify(
                  result.data
                )}`,
              },
            ],
          };
        } catch (uploadError) {
          console.error("UploadThing API error:", uploadError);
          throw uploadError;
        }
      } catch (error) {
        console.error("File upload error:", error);

        // Return error response
        return {
          content: [
            {
              type: "text",
              text: `File upload failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return {
    mcpServer,
    utapi,
  };
}
