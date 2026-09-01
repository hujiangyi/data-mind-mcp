# 快速开始

1. 在 DataMind Go 网页中使用真实邮箱注册，或者在已有私有化部署中从
   Go 服务管理员处取得 MCP 凭据对。
2. 启用邮件发送时，从注册邮箱中取得 MCP 安装参数。
3. 使用 `install/install.sh` 或 `install/install.ps1` 安装 MCP 客户端。
4. 重启对应 MCP 客户端。
5. 检查 MCP 工具列表。
6. 只有需要云端 AI 能力时，才在 Go 服务侧配置云端 API Key。

单独检查 MCP 协议：

```bash
cd packages/datamind-mcp
npm ci
npm test
npm run build
```

普通用户凭据暴露查询和探查工具。管理员凭据可以额外暴露身份管理工具。
即使客户端手工构造管理员工具请求，Go 服务也必须再次执行权限拒绝。
注册接口响应不会包含 MCP 凭据或主密钥，安装参数只发送到注册邮箱。
