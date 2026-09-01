# MCP 安装说明

本说明只负责把 DataMind MCP 客户端接入已经运行的 DataMind Go 服务。
它不会安装 Go 服务、配置数据库、配置 Nginx，也不会创建或替换 MCP 凭据。

## 使用前准备

普通用户需要先在 DataMind Go 服务网页使用真实邮箱注册。服务会把以下
安装参数发送到注册邮箱：

```text
DATAMIND_API_BASE
DATAMIND_CREDENTIAL
DATAMIND_MASTER_KEY
```

已有私有化部署可以由管理员签发 MCP 凭据对。

普通用户不需要安装 Go、Docker、Nginx，也不需要取得 DataMind Cloud
API Key。

## 客户端安装

安装脚本需要四个参数：

```text
--tool
--api-base
--credential
--master-key
```

例如：

```bash
bash install/install.sh \
  --tool claude-desktop \
  --api-base https://go.example.com \
  --credential 'ENC:V1:...' \
  --master-key 'MKEY:...'
```

支持的客户端：

```text
claude-desktop
claude-code
cursor
vscode
opencode
continue
```

脚本会下载 MCP Release、更新客户端配置，并在 Claude Code 中安装查询
Skill。安装完成后必须重启对应的 AI 客户端。

PowerShell 用户可以执行：

```powershell
.\install\install.ps1 `
  -Tool claude-code `
  -ApiBase https://go.example.com `
  -Credential "ENC:V1:..." `
  -MasterKey "MKEY:..."
```

## 安装后验证

在 AI 客户端中尝试：

```text
请列出我可以访问的数据源
请描述一个我有权限访问的数据表
请查询这个表最近的几条记录
```

如果看不到工具，请先确认已重启客户端，并检查凭据是否来自同一个
DataMind Go 服务。

## 升级和卸载

升级时使用新的 MCP Release 版本重新执行安装脚本。卸载 MCP 客户端：

```bash
bash install/uninstall.sh --tool claude-desktop
```

脚本只修改 MCP 客户端配置，不会删除 DataMind Go 服务上的数据。

## 相关说明

- [快速开始](quickstart.md)
- [Release 镜像](release-mirrors.md)
- [故障排查](troubleshooting.md)
- [服务端授权与协议说明](https://github.com/hujiangyi/data-mind-server/tree/main/docs/zh-CN)
