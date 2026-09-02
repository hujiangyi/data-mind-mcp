# Troubleshooting

## MCP client exits immediately

Check that `DATAMIND_CREDENTIAL`, `DATAMIND_MASTER_KEY`, and
`DATAMIND_API_BASE` are all present. The pair must belong to the same Go
service and must not be mixed between users.

## First sign-in password change is required

If the setup page reports that the account still needs a password change, sign
in to the DataMind Go website first. A fresh administrator uses the temporary
password `123456`; administrator-created or reset accounts use the same value.
Self-registered accounts must also complete the password-change page. Set a
formal password of 8 to 16 characters, then reopen the setup link.

## Query tools are missing

The MCP client filters tools by credential scopes. Check the scopes issued by
the Go service. Do not add an administrator scope in the client configuration;
the Go service remains authoritative.

## Cloud AI is unavailable

The MCP client only connects to the Go service. It does not store or manage a
DataMind Cloud API key. Ask the Go service operator to check the active cloud
profile, membership status, quota, and queue class.

## MCP installation email was not received

First verify that the mailbox address was entered correctly, can currently
receive mail, and has been checked for spam, promotions, quarantine, and
enterprise mail-gateway filtering. Mail providers apply different filtering
rules, so retrying with another real and reachable mailbox is recommended.

If several valid mailboxes fail to receive the message, contact the Go service
operator with the registration time and a masked mailbox address. Do not copy
MCP credentials into public issue reports or chat messages.
