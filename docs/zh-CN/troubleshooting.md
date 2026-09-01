# 故障排查

## MCP 客户端立即退出

检查 `DATAMIND_CREDENTIAL`、`DATAMIND_MASTER_KEY` 和
`DATAMIND_API_BASE` 是否全部存在。凭据对必须来自同一个 Go 服务，
不能混用不同用户的配置。

## 查询工具没有显示

MCP 客户端会根据凭据 scope 过滤工具。请检查 Go 服务签发的 scope。
不要在客户端配置中自行添加管理员 scope，最终权限仍由 Go 服务判断。

## 云端 AI 不可用

MCP 客户端只负责连接 Go 服务，不保存也不管理 DataMind Cloud API Key。
请联系 Go 服务管理员检查服务端的云端 profile、会员状态、额度和队列等级。

## 没有收到 MCP 安装邮件

检查 Go 服务响应中的 `emailDelivery`。`sent` 表示 Cloud 已接受邮件，
`failed` 或 `not_configured` 需要由 Go 服务管理员检查 Cloud Node 日志和
Resend 环境。不要把 MCP 凭据复制到公开 Issue 或聊天消息中。
