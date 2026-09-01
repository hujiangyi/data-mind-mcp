# 云端 API Key

云端 API Key 属于 Go 服务与 DataMind 云端 AI 中转之间的链路，
与 MCP 凭据对相互独立。当前托管 Cloud 地址为
`https://dm.iter-self.top`，私有化部署可以使用其他地址。

网站注册成功后签发免费 Key。会员开通成功后签发会员 Key。免费 Key 保留，
会员 Key 有效时 Go CLI 默认优先使用会员 Key。

```bash
datamind cloud auth add --name free --key '<free-key>'
datamind cloud auth add --name member --key '<member-key>'
datamind cloud auth use --name member
datamind cloud auth list
datamind cloud plan --base-url https://dm.iter-self.top
datamind cloud usage --base-url https://dm.iter-self.top
```

`auth list` 只输出脱敏 Key。配置文件应只允许当前用户读取，怀疑泄露时应
立即轮换。
