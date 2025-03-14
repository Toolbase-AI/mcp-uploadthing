import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UTApi } from "uploadthing/server";
import * as fs from "node:fs/promises";
import { z } from "zod";

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
    version: "0.0.2",
  });

  // Create UploadThing API client
  const utapi = new UTApi({
    token,
  });

  // Add the upload file tool
  mcpServer.tool(
    "upload-files",
    "Upload files to UploadThing. Given a list of file with their paths, names, and types, it will upload the files to UploadThing and return the URLs of the uploaded files.",
    {
      files: z
        .array(
          z.object({
            filePath: z.string().describe("Path to file to upload"),
            fileName: z.string().describe("Name of the file to upload"),
            fileType: z
              .string()
              .describe(
                "MIME type of the file (e.g., 'image/jpeg', 'application/pdf')"
              ),
          })
        )
        .describe(
          "Array of files to upload to UploadThing. This includes the file path, file name, and file type."
        ),
    },
    async (params) => {
      try {
        const filesPromises = params.files.map(async (file) => {
          const buffer = await fs.readFile(file.filePath);

          const fileObj = new File([buffer], file.fileName, {
            type: file.fileType,
          });

          return fileObj;
        });

        const files = await Promise.allSettled(filesPromises);

        const failedFiles = files
          .map((file, idx) => ({
            ...file,
            path: params.files[idx].filePath,
          }))
          .filter((file) => file.status === "rejected");

        if (failedFiles.length > 0) {
          throw new Error(
            `Failed to read files given the following paths: ${failedFiles
              .map((file) => `${file.path}: ${JSON.stringify(file.reason)}`)
              .join(", ")}`
          );
        }

        const succesfulFiles = files
          .filter((file) => file.status === "fulfilled")
          .map((file) => file.value);

        if (succesfulFiles.length === 0) {
          throw new Error("No files could be read to be uploaded");
        }

        try {
          // Upload the file using UploadThing API
          // Note: The uploadFiles method expects a FileEsque object or array
          const results = await utapi.uploadFiles(succesfulFiles);

          const failedUploads = results
            .map((result, idx) => ({
              error: result.error,
              file: succesfulFiles[idx],
            }))
            .filter((result) => result.error);

          const successfulUploads = results
            .map((result, idx) => ({
              data: result.data,
              file: succesfulFiles[idx],
            }))
            .filter((result) => result.data);

          if (failedUploads.length > 0) {
            throw new Error(
              `
              Successfully uploaded files: ${successfulUploads
                .map(
                  (upload) =>
                    `${upload.file.name}: ${JSON.stringify(upload.data)}`
                )
                .join(", ")}\n\n

              Failed to upload files: ${failedUploads
                .map(
                  (upload) =>
                    `${upload.file.name}: ${JSON.stringify(upload.error)}`
                )
                .join(", ")}
              `
            );
          }

          return {
            content: [
              {
                type: "text",
                text: `
                Successfully uploaded files: ${successfulUploads
                  .map(
                    (upload) =>
                      `${upload.file.name}: ${JSON.stringify(upload.data)}`
                  )
                  .join(", ")}
                `,
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
              text: `Files upload failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  mcpServer.tool(
    "upload-files-from-urls",
    "Upload files by URL to UploadThing. Given a list of URLs, it will upload the files by URL to UploadThing and return the URLs of the uploaded files.",
    {
      filesByURL: z
        .array(z.string().url())
        .describe("Array of URLs of files to upload to UploadThing."),
    },
    async (params) => {
      try {
        const urls = params.filesByURL;
        const results = await utapi.uploadFilesFromUrl(urls);

        const failedUploads = results
          .map((result, idx) => ({
            error: result.error,
            url: urls[idx],
          }))
          .filter((result) => result.error);

        const successfulUploads = results
          .map((result, idx) => ({
            data: result.data,
            url: urls[idx],
          }))
          .filter((result) => result.data);

        if (failedUploads.length > 0) {
          throw new Error(
            `
              Successfully uploaded files by URL: ${successfulUploads
                .map(
                  (upload) => `${upload.url}: ${JSON.stringify(upload.data)}`
                )
                .join(", ")}\n\n

              Failed to upload files by URL: ${failedUploads
                .map(
                  (upload) => `${upload.url}: ${JSON.stringify(upload.error)}`
                )
                .join(", ")}
              `
          );
        }

        return {
          content: [
            {
              type: "text",
              text: `
                Successfully uploaded files by URL: ${successfulUploads
                  .map(
                    (upload) => `${upload.url}: ${JSON.stringify(upload.data)}`
                  )
                  .join(", ")}
                `,
            },
          ],
        };
      } catch (error) {
        console.error("File upload error:", error);
        return {
          content: [
            {
              type: "text",
              text: `Files by URL upload failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return mcpServer;
}
