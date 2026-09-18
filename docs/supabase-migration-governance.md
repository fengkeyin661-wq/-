# Supabase 迁移治理规范

## 迁移执行顺序
1. dev
2. staging
3. production

每一步必须执行：
- 结构验证
- 策略验证
- 核心写链路验证（随访写入/用户写入）

## 迁移文件规范
- 文件名：`NNN_feature_description.sql`
- 必须幂等：`if exists` / `if not exists`
- 必须可回滚：每个高风险迁移附 rollback SQL

## 执行后验证 SQL
见：`supabase/sql/health_archives_verification.sql`

## 权限异常诊断 SQL
见：`supabase/sql/health_archives_diagnostics.sql`

## 禁止项
- 禁止在生产直接手改表结构（必须通过 migration）
- 禁止不经评审调整核心表字段含义
