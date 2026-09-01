# MCP Installation

This document connects the DataMind MCP client to an existing DataMind Go
service. It does not install the Go service, configure a database, configure
Nginx, or create and replace MCP credentials.

## Before installation

Normal users should register with a real mailbox in the DataMind Go web
interface first. The service sends these installation values to the registered
mailbox:

```text
DATAMIND_API_BASE
DATAMIND_CREDENTIAL
DATAMIND_MASTER_KEY
```

For an existing private deployment, an administrator can issue the MCP
credential pair.

Normal users do not need Go, Docker, Nginx, a DataMind Cloud API key.

## Install the client

The installer requires four values:

```text
--tool
--api-base
--credential
--master-key
```

Example:

```bash
bash install/install.sh \
  --tool claude-desktop \
  --api-base https://go.example.com \
  --credential 'ENC:V1:...' \
  --master-key 'MKEY:...'
```

Supported clients:

```text
claude-desktop
claude-code
cursor
vscode
opencode
continue
```

The installer downloads the MCP Release, updates the client configuration, and
installs the query Skill for Claude Code. Restart the selected AI client after
installation.

PowerShell users can run:

```powershell
.\install\install.ps1 `
  -Tool claude-code `
  -ApiBase https://go.example.com `
  -Credential "ENC:V1:..." `
  -MasterKey "MKEY:..."
```

## Verify the installation

Try these prompts in the AI client:

```text
List the data sources I can access.
Describe a data table that I am allowed to access.
Query the latest rows from that table.
```

If the tools are missing, restart the client and confirm that all credential
values came from the same DataMind Go service.

## Upgrade and uninstall

Run the installer again with a new MCP Release version to upgrade. To remove
the MCP client:

```bash
bash install/uninstall.sh --tool claude-desktop
```

The installer changes only the MCP client configuration. It does not delete
data from the DataMind Go service.

## Related documentation

- [Quickstart](quickstart.md)
- [Release mirrors](release-mirrors.md)
- [Troubleshooting](troubleshooting.md)
- [Server API key and protocol documentation](https://github.com/hujiangyi/data-mind-server/tree/main/docs/en)
