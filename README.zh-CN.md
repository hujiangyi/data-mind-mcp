# DataMind MCP

DataMind MCP 是面向 AI 客户端的开源 MCP 客户端、Skill 和安装工具。
它把已经部署好的 DataMind Go 服务接入 Claude Desktop、Claude Code、
Codex、Cursor、VS Code、OpenCode ，让 AI 在服务器权限控制下查询业务数据。

本仓库只负责客户端侧能力：

- MCP 客户端；
- 数据查询和管理员 Skill；
- macOS、Linux、Windows 客户端安装脚本；
- MCP 协议、配置和故障排查文档。

Go 服务、Vue 管理页面、数据源配置、Cloud API Key 和内部 Cloud 服务凭据
不在本仓库中。服务端发行版和部署文档请查看
`hujiangyi/data-mind-server`。

## 五分钟开始

### 1. 先确认服务地址和安装参数

你需要先取得 DataMind Go 服务的公开地址，以及服务发送到邮箱中的：

```text
DATAMIND_API_BASE
DATAMIND_CREDENTIAL
DATAMIND_MASTER_KEY
```

普通用户可以在 DataMind Go 服务网页注册。注册成功后，安装参数会发送到
注册邮箱。管理员也可以为用户签发 MCP 凭据。

所有新账号在使用 MCP 前都必须完成首次改密。全新 DataMind Server 安装
使用管理员账号 `admin` 和临时初始密码 `123456` 登录，随后必须改成
8～16 位正式密码。管理员创建或重置的账号也统一使用 `123456`，第一次
登录必须改密。普通用户自助注册时可以设置初始密码，但第一次登录同样
必须重新设置正式密码。如果配置页面提示账号仍需改密，请先登录 Go 服务
完成改密，再重新打开邮件中的安装链接。

### 2. 安装 MCP 客户端

下面的参数需要替换为邮件中的真实值：

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
codex
cursor
vscode
opencode
```

安装脚本会下载对应版本的 MCP Release，写入客户端配置，并在支持的客户端
中安装查询 Skill。完成后重启对应的 AI 客户端。

### 3. 验证安装

在 AI 客户端中依次尝试：

```text
请列出我可以访问的数据源
请描述一个我有权限访问的表
请查询这个表最近几条数据
```

如果能看到数据源和查询结果，说明 MCP 客户端、Go 服务和当前用户权限已经
连通。

## 权限范围

普通用户默认可以使用：

```text
datamind_list_datasources
datamind_describe_table
datamind_query
```

管理员凭据可以额外使用数据源身份管理能力。客户端显示工具只是第一层
控制，Go 服务端仍会对每个请求执行权限校验。普通用户即使手动构造管理员
工具请求，也不能获得管理员权限。

## 本地开发

```bash
cd packages/datamind-mcp
npm ci
npm test
npm run build
```

本项目的 MCP 客户端不依赖额外运行时包。正常使用时，安装脚本会直接下载
Release 中的可执行 MCP 客户端；从源码构建时需要 Node.js。

## 许可证

本仓库中的 MCP 客户端、Skill、安装脚本、示例和文档采用 Apache License 2.0。

English documentation: [README.md](README.md)
