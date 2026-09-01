# MCP 与云端 API Key 边界

DataMind 使用两套相互独立的协议。

## MCP 协议

MCP 客户端通过原有 MCP 协议与 DataMind Go 服务通信：

- `DATAMIND_API_BASE`
- `DATAMIND_CREDENTIAL`
- `DATAMIND_MASTER_KEY`
- 短期 JWT
- `query`、`describe`、`admin` scope

客户端只在内存中解密凭据，并根据 scope 动态暴露工具。身份、数据权限、
行级过滤和管理员检查仍由 Go 服务负责。

## 云端 AI 协议

Go 服务或 Go CLI 使用网站签发的免费 API Key 或会员 API Key 访问
DataMind 云端 AI 中转。云端 Key 控制队列优先级、额度、会员状态和用量统计。

云端 API Key 不是 MCP 凭据，不能写入 MCP 客户端的环境变量配置。

## 注册邮件

Go 服务可以在注册时创建普通用户的 MCP 凭据，并通过配置好的 Cloud 邮件
接口发送安装参数。注册接口只返回邮件投递状态，不返回凭据内容。用户
修改邮箱或请求重发时，旧 MCP 凭据会先撤销，再签发新的凭据。Cloud 邮件
接口只是服务间边界，不属于 MCP stdio 协议。
