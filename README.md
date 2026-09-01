# DataMind MCP

DataMind MCP is an open-source MCP client, Skills, and installer toolkit for
connecting AI clients to an existing DataMind Go service.

This repository contains the client-side experience:

- MCP client;
- data query and administrator Skills;
- macOS, Linux, and Windows client installers;
- MCP protocol, configuration, and troubleshooting documentation.

The Go service, Vue administration UI, data-source configuration, Cloud API
keys, and Agnes API keys are not included here. Server distributions and
deployment guides are published in `hujiangyi/data-mind-server`.

## Start in five minutes

### 1. Get the service address and install parameters

You need the public DataMind Go service address and the following values from
the installation email:

```text
DATAMIND_API_BASE
DATAMIND_CREDENTIAL
DATAMIND_MASTER_KEY
```

Normal users can register through the DataMind Go service. The installation
parameters are sent to the registered mailbox. Administrators can also issue
MCP credentials for users.

### 2. Install the MCP client

Replace the placeholders with the values from the email:

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
codex
cursor
vscode
opencode
```

The installer downloads the versioned MCP Release, updates the client
configuration, and installs the query Skill for clients that support it.
Restart the AI client after installation.

### 3. Verify the connection

Try these prompts in the AI client:

```text
List the data sources I can access.
Describe a table that I am allowed to access.
Query the latest rows from that table.
```

Seeing data sources and query results confirms that the MCP client, Go service,
and user permissions are connected.

## Permission scopes

Normal users can use:

```text
datamind_list_datasources
datamind_describe_table
datamind_query
```

Administrator credentials can additionally use data-source identity management.
Tool visibility is only the first control layer. The Go service validates every
request, so a normal user cannot obtain administrator access by manually
constructing an administrator tool request.

## Local development

```bash
cd packages/datamind-mcp
npm ci
npm test
npm run build
```

The MCP client has no runtime package dependencies. Normal users download the
built client from a Release; Node.js is needed when building from source.

## License

The MCP client, Skills, installers, examples, and documentation in this
repository are licensed under Apache License 2.0.

简体中文说明：[README.zh-CN.md](README.zh-CN.md)
