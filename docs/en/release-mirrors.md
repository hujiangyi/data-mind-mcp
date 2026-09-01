# MCP Release Mirrors

DataMind MCP Releases are synchronized to GitHub and Gitee:

```text
GitHub: https://github.com/hujiangyi/data-mind-mcp
Gitee:  https://gitee.com/hujiangyi/data-mind-mcp
```

Both repositories should keep the same `main` branch, version tags, asset
names, and `checksums.txt` contents. The MCP installer uses GitHub by default.
Set `DATAMIND_RELEASE_BASE` to use another mirror.

## Client Release URL

```bash
export DATAMIND_RELEASE_BASE="https://github.com/hujiangyi/data-mind-mcp/releases/download"
```

For a private mirror:

```bash
export DATAMIND_RELEASE_BASE="https://mirror.example.com/datamind-mcp/releases"
```

## Gitee synchronization

Add the Gitee remote and synchronize the public branch and tags:

```bash
git remote add gitee git@gitee.com:hujiangyi/data-mind-mcp.git
git push gitee main --tags
```

Release assets must also be uploaded to the Gitee Release manually. Assets
with the same name must be byte-for-byte identical on GitHub and Gitee, or the
`checksums.txt` verification will fail.

## Asset requirements

An MCP Release should include the platform assets and:

```text
checksums.txt
release-manifest.json
```

Release assets are built and uploaded locally; GitHub Actions are not required.
