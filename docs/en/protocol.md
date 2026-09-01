# MCP and Cloud API Key Boundaries

DataMind uses two independent protocols.

## MCP protocol

The MCP client communicates with the DataMind Go service through the existing
MCP protocol:

- `DATAMIND_API_BASE`
- `DATAMIND_CREDENTIAL`
- `DATAMIND_MASTER_KEY`
- short-lived JWTs
- `query`, `describe`, and `admin` scopes

The client decrypts the credential in memory and dynamically exposes tools
according to its scopes. The Go service remains the authority for identity,
data permissions, row filtering, and administrator checks.

## Cloud AI protocol

The Go service or Go CLI communicates with the DataMind cloud AI relay with a
website-issued free or member API key. The cloud key controls queue priority,
quota, membership status, and usage accounting.

The cloud API key is not an MCP credential and must never be added to an MCP
client environment block.

## Registration email

The Go service may create a normal-user MCP credential during registration and
deliver the installation parameters through the configured Cloud email
endpoint. The registration response contains delivery status only. Changing
the account email or requesting a resend revokes the previous MCP credentials
before issuing a replacement. The Cloud email endpoint is an internal service
boundary; it is not part of the MCP stdio protocol.
