# MCP Release 镜像

DataMind MCP 客户端 Release 同步到 GitHub 和 Gitee：

```text
GitHub：https://github.com/hujiangyi/data-mind-mcp
Gitee： https://gitee.com/hujiangyi/data-mind-mcp
```

两个仓库应保持相同的 `main` 分支、版本标签、资产名称和
`checksums.txt` 内容。MCP 安装脚本默认优先使用 GitHub，也可以通过
`DATAMIND_RELEASE_BASE` 指向其他镜像。

## 客户端 Release 地址

```bash
export DATAMIND_RELEASE_BASE="https://github.com/hujiangyi/data-mind-mcp/releases/download"
```

如果使用自建镜像：

```bash
export DATAMIND_RELEASE_BASE="https://mirror.example.com/datamind-mcp/releases"
```

## Gitee 同步

为本地仓库增加 Gitee remote 后，可以同步分支和标签：

```bash
git remote add gitee git@gitee.com:hujiangyi/data-mind-mcp.git
git push gitee main --tags
```

Release 资产也需要在 Gitee 中手动上传。GitHub 和 Gitee 中的同名资产
必须保持字节完全一致，否则 `checksums.txt` 会失效。

## 资产要求

MCP Release 应至少包含当前平台对应的客户端资产和：

```text
checksums.txt
release-manifest.json
```

Release 资产由本地构建后上传，不依赖 GitHub Actions。
