# Quickstart

1. Register in the DataMind Go web interface with a real mailbox, or obtain an
   MCP credential pair from the Go service administrator for an existing
   private deployment.
2. Check the mailbox for the MCP installation parameters when email delivery is
   enabled.
3. Install the MCP client with `install/install.sh` or
   `install/install.ps1`.
4. Restart the selected MCP client.
5. Verify the MCP tool list.
6. Configure a cloud API key in the Go service only when cloud AI features
   are needed.

For a standalone protocol check:

```bash
cd packages/datamind-mcp
npm ci
npm test
npm run build
```

The normal user credential exposes query and describe tools. An administrator
credential may additionally expose identity management tools. The server must
enforce the same boundary even if a client sends a handcrafted tool request.
Registration responses do not contain the MCP credential or master key; the
installation message is delivered to the registered mailbox.
