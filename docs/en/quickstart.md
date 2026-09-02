# Quickstart

1. Register with a real mailbox in the DataMind Go web interface, or obtain an
   account from the Go service administrator.
2. Sign in to the Go service and complete the required first-sign-in password
   change. A fresh administrator uses `admin` / `123456`; managed accounts
   use the same temporary password.
3. Check the mailbox for the MCP installation parameters when email delivery is
   enabled.
4. Install the MCP client with `install/install.sh` or
   `install/install.ps1`.
5. Restart the selected MCP client.
6. Verify the MCP tool list.

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
