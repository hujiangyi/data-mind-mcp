# Cloud API Keys

Cloud API keys belong to the Go service and the DataMind cloud AI relay.
They are separate from the MCP credential pair. The current hosted Cloud base
URL is `https://dm.iter-self.top`; self-hosted operators may use another base.

The website issues a free key after registration. A successful membership
activation issues a member key. The free key remains available, while the Go
CLI prefers the member key when it is active.

```bash
datamind cloud auth add --name free --key '<free-key>'
datamind cloud auth add --name member --key '<member-key>'
datamind cloud auth use --name member
datamind cloud auth list
datamind cloud plan --base-url https://dm.iter-self.top
datamind cloud usage --base-url https://dm.iter-self.top
```

Only masked keys are printed by `auth list`. Store the profile file with
user-only permissions and rotate a key immediately after suspected exposure.
