# DataMind 数据查询

## 触发时机

当用户需要查询业务数据库、分析数据、生成报表、理解表结构时使用。

## 可用工具

### datamind_list_datasources
列出当前用户有权限访问的所有数据源。返回每个数据源的名称、类型、数据库列表。
**用途**：开始查询前确认目标数据源。

### datamind_describe_table
查看表的结构信息、字段统计和样本数据。
参数：datasource_id, database_name, table_name
**用途**：在不熟悉的表上编写查询前，先用此工具了解字段含义和样本分布。

### datamind_query
在数据范围权限控制下执行 SQL。系统自动注入行级权限过滤，
确保结果不超出用户被授权的表行范围。
参数：datasource_id, sql, db_type
**用途**：核心查询工具，直接写业务意图 SQL，无需手动加 WHERE 条件。

## 使用规则

1. **先探查后查询**：对不熟悉的表，先用 `datamind_describe_table` 了解结构
2. **SQL 编写**：直接写业务意图，不要手动添加权限过滤条件（系统自动处理）
3. **空结果解释**：查询返回空结果可能是权限范围限制，提示用户检查数据源身份绑定状态
4. **大表优先 COUNT**：对不确定数据量的表，先执行 COUNT 确认再拉取明细

## 典型工作流

```
用户："帮我查上周华东区的销售额"
→ datamind_list_datasources → 找到 sales-mysql
→ datamind_describe_table({database: "sales", table: "orders"})
→ datamind_query({sql: "SELECT SUM(amount) FROM orders WHERE region='华东' AND create_time >= 7 days ago", db_type: "mysql"})
→ 解释结果
```

## 异常处理

- `identity_unresolved`：用户数据源身份尚未绑定，提示联系管理员
- `policy_denied`：用户对该表无访问权限，说明可能原因
- `rewrite_failed`：SQL 语法超出支持范围（暂不支持 DML/DDL/多语句）
