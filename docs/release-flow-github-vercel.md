# GitHub + Vercel 发布流程（staging / production）

## 分支策略
- `main`：生产环境
- `staging`：预发布环境
- `feat/*`：功能开发

## 合并策略
1. `feat/*` -> `staging`：功能联调
2. `staging` 验收通过 -> `main`：发布生产

## Vercel 环境建议
- Preview：所有 PR 自动生成
- Staging：关联 `staging` 分支
- Production：关联 `main` 分支

## 子域名门户（hostname 路由）

应用通过 `App.tsx` 中 `detectPortalModeFromHostname` 识别子域名，无需单独部署：

| 子域名前缀 | 门户 | 说明 |
|-----------|------|------|
| `admin.` | 管理控制台 | 管理员 / 健康管家登录 |
| `ops.` | 健康资源管理台 | 资源运营（含体检套餐维护） |
| `doctor.` | 签约医生端 | 医生工作站 |
| `user.` | 职工健康端 | 需档案登录 |
| `tj.` | 体检预约 | 访客浏览套餐并预约，无需登录 |

**Vercel 配置步骤（以 `tj.` 为例）：**

1. Vercel 项目 → Settings → Domains → 添加 `tj.<your-domain>`
2. DNS 添加 CNAME：`tj` → Vercel 提供的地址
3. Staging / Production 各配置一次（与 `admin.`、`ops.` 等同理）

**本地开发验证：**

1. 在 hosts 添加：`127.0.0.1 tj.localhost`
2. 启动 `npm run dev` 后访问 `http://tj.localhost:5173`，应直接进入体检预约门户

## 发布前检查
- `npx tsc --noEmit`
- 医生端随访提交后：
  - 用户端基础指标更新
  - 用户端随访执行单更新
  - 下次随访时间展示 + D-7/D-3/D0 提醒

## 回滚
- 代码：Vercel -> Deployments -> Promote previous build
- 数据：执行对应 migration 回滚 SQL（如果涉及结构变更）

## 必需环境变量（Vercel）
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` 或 `VITE_SUPABASE_ANON_KEY`
- `VITE_DEEPSEEK_API_KEY`
