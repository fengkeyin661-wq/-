# Health Guard CN

## 项目定位
面向教职工健康管理闭环：体检 -> AI评估 -> 分层干预 -> 随访执行 -> 数据回流 -> AI再评估。

## 本地开发
1. `npm install`
2. 配置环境变量（Vercel 同步）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY` 或 `VITE_SUPABASE_ANON_KEY`
   - `VITE_DEEPSEEK_API_KEY`
3. `npm run dev`

## 质量检查
- 类型检查：`npx tsc --noEmit`

## 关键文档
- 数据字典：[docs/health-core-data-dictionary.md](docs/health-core-data-dictionary.md)
- 发布流程：[docs/release-flow-github-vercel.md](docs/release-flow-github-vercel.md)
- Supabase迁移治理：[docs/supabase-migration-governance.md](docs/supabase-migration-governance.md)
- 周验收与KPI：[docs/weekly-kpi-acceptance.md](docs/weekly-kpi-acceptance.md)
- 迁移验证SQL：[supabase/sql/health_archives_verification.sql](supabase/sql/health_archives_verification.sql)
- 故障诊断SQL：[supabase/sql/health_archives_diagnostics.sql](supabase/sql/health_archives_diagnostics.sql)
