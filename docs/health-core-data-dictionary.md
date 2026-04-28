# 教职工健康管理系统：核心健康指标数据字典（冻结版 v1.0）

## 1. 数据同源原则
- 主档案：`public.health_archives`
- 核心指标真值源：`health_archives.health_record`
- 随访记录：`health_archives.follow_ups`
- 随访计划：`health_archives.follow_up_schedule`
- 评估与方案：`health_archives.assessment_data`

## 2. 核心指标字段（统一单位）

| 指标 | 字段路径 | 单位 | 类型 | 有效区间（运营校验） |
|---|---|---|---|---|
| 收缩压 | `health_record.checkup.basics.sbp` | mmHg | number | 40-300 |
| 舒张压 | `health_record.checkup.basics.dbp` | mmHg | number | 30-200 |
| 体重 | `health_record.checkup.basics.weight` | kg | number | 20-300 |
| BMI | `health_record.checkup.basics.bmi` | kg/m2 | number | 10-80 |
| 空腹血糖 | `health_record.checkup.labBasic.glucose.fasting` | mmol/L | string(number) | 1.0-35.0 |
| 总胆固醇 | `health_record.checkup.labBasic.lipids.tc` | mmol/L | string(number) | 1.0-20.0 |
| 甘油三酯 | `health_record.checkup.labBasic.lipids.tg` | mmol/L | string(number) | 0.1-20.0 |
| 低密度脂蛋白 | `health_record.checkup.labBasic.lipids.ldl` | mmol/L | string(number) | 0.1-15.0 |
| 高密度脂蛋白 | `health_record.checkup.labBasic.lipids.hdl` | mmol/L | string(number) | 0.1-10.0 |

## 3. 来源规则
- `doctor_followup`：医生/健康管家随访写入
- `user_profile_edit`：用户端自主更新
- `system`：系统自动修正/同步

字段：`health_archives.last_sync_source`

## 4. 冲突规则
- 同一用户同一字段采用“最后写入生效”（以 `updated_at` 为准）
- 写入后必须回读一次档案并覆盖本地缓存

## 5. 必须满足的链路
1) 医生随访提交 -> `follow_ups + follow_up_schedule + assessment_data + health_record` 同次写入
2) 用户自主编辑 -> 仅更新 `health_record`，并触发用户端回读
3) 用户端读取基础指标 -> 只读 `health_record`

## 6. 质量阈值
- 跨端同一用户同一字段一致率 >= 99%
- 随访更新后用户端可见延迟 <= 10 秒（Realtime 优先）
