# Figma Setup for Context7 MCP

To generate your webpage, I need access to the Figma file.

1.  **Personal Access Token**:
    *   Go to Figma -> Settings -> Security -> Create new personal access token.
    *   Copy the token.

2.  **File Key**:
    *   Open your Figma file in the browser.
    *   The URL looks like: `https://www.figma.com/file/aSdFgHjKl/My-Design?node-id=...`
    *   The key is `r2PV0r0Hee1UVtXufgGHIW`.

## Configuration
Please create a file named `.env` (or let me know the values) with:

```env
FIGMA_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
FIGMA_FILE_KEY=YOUR_FILE_KEY_HERE
```
