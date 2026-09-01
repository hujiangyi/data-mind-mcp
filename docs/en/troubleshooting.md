# Troubleshooting

## MCP client exits immediately

Check that `DATAMIND_CREDENTIAL`, `DATAMIND_MASTER_KEY`, and
`DATAMIND_API_BASE` are all present. The pair must belong to the same Go
service and must not be mixed between users.

## Query tools are missing

The MCP client filters tools by credential scopes. Check the scopes issued by
the Go service. Do not add an administrator scope in the client configuration;
the Go service remains authoritative.

## Cloud AI is unavailable

The MCP client only connects to the Go service. It does not store or manage a
DataMind Cloud API key. Ask the Go service operator to check the active cloud
profile, membership status, quota, and queue class.

## MCP installation email was not received

Check the Go service response for `emailDelivery`. A value of `sent` means the
Cloud service accepted the message; `failed` or `not_configured` requires the
Go service operator to check the Cloud Node logs and its Resend environment.
Do not copy MCP credentials into public issue reports or chat messages.
