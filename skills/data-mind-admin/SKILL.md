# DataMind 数据管理

## 额外可用工具（需 admin scope）

### datamind_manage_identity
管理员工具：查看用户数据源身份绑定状态，手动绑定/解绑。
参数：action(list|bind), user_id, datasource_id, external_value
**用途**：解决 identity_unresolved 错误，处理用户首次查询时的身份绑定问题。

## 使用规则

在基础 Skill 之上，可协助管理员：
1. 排查用户查询失败的根因
2. 批量查看数据源的身份绑定覆盖率
3. 手动修正错误绑定的外部身份
