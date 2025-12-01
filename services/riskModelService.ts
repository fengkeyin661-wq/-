
import { HealthRecord, RiskAnalysisData, SystemRiskPortrait, PredictionModelResult, RiskLevel } from '../types';

/**
 * 1. 生成 6 大系统健康画像
 * 基于体检异常项和问卷数据，将问题归类到各生理系统
 */
export const generateSystemPortraits = (record: HealthRecord): SystemRiskPortrait[] => {
    const findings = {
        cv: [] as string[], // 心脑
        meta: [] as string[], // 代谢免疫
        resp: [] as string[], // 呼吸
        dig: [] as string[], // 消化
        tumor: [] as string[], // 肿瘤
        psych: [] as string[] // 心理
    };

    // Helper to add finding
    const add = (sys: keyof typeof findings, text: string) => {
        if (!findings[sys].includes(text)) findings[sys].push(text);
    };

    // 1. Scan Abnormalities
    record.checkup.abnormalities.forEach(ab => {
        const t = (ab.item + ab.result).toLowerCase();
        
        // 心脑
        if (t.includes('血压') || t.includes('心率') || t.includes('心律') || t.includes('早搏') || t.includes('st段') || t.includes('动脉') || t.includes('斑块') || t.includes('同型半胱氨酸')) add('cv', `${ab.item}: ${ab.result}`);
        
        // 代谢免疫
        if (t.includes('血糖') || t.includes('糖化') || t.includes('尿酸') || t.includes('胆固醇') || t.includes('甘油三酯') || t.includes('脂') || t.includes('甲状腺') || t.includes('t3') || t.includes('t4') || t.includes('肥胖')) add('meta', `${ab.item}: ${ab.result}`);
        
        // 呼吸
        if (t.includes('肺') || t.includes('支气管') || t.includes('呼吸')) add('resp', `${ab.item}: ${ab.result}`);
        
        // 消化
        if (t.includes('肝') || t.includes('胆') || t.includes('胰') || t.includes('脾') || t.includes('胃') || t.includes('肠') || t.includes('幽门')) add('dig', `${ab.item}: ${ab.result}`);
        
        // 肿瘤
        if (t.includes('癌') || t.includes('瘤') || t.includes('占位') || t.includes('afp') || t.includes('cea') || t.includes('ca1') || t.includes('结节') || t.includes('bi-rads')) add('tumor', `${ab.item}: ${ab.result}`);
    });

    // 2. Scan Questionnaire
    // History
    record.questionnaire.history.diseases.forEach(d => {
        if (d.includes('高血压') || d.includes('冠心病') || d.includes('卒中')) add('cv', `既往史: ${d}`);
        if (d.includes('糖尿病') || d.includes('痛风') || d.includes('甲状腺')) add('meta', `既往史: ${d}`);
        if (d.includes('慢肺') || d.includes('哮喘')) add('resp', `既往史: ${d}`);
        if (d.includes('胃病') || d.includes('脂肪肝')) add('dig', `既往史: ${d}`);
        if (d.includes('肿瘤')) add('tumor', `既往史: ${d}`);
    });
    // Mental
    if (record.questionnaire.mental.stressLevel === '较大' || record.questionnaire.mental.stressLevel === '很大') add('psych', '自述压力较大');
    if (record.questionnaire.sleep.quality === '差') add('psych', '睡眠质量差');
    if (record.questionnaire.sleep.hours && parseInt(record.questionnaire.sleep.hours) < 5) add('psych', '睡眠时间不足');

    // 3. Construct Portraits
    const buildPortrait = (name: string, icon: string, keyItems: string[], focus: string[]): SystemRiskPortrait => ({
        systemName: name,
        icon,
        status: keyItems.length > 2 ? 'High' : keyItems.length > 0 ? 'Medium' : 'Normal',
        keyFindings: keyItems.slice(0, 4), // Top 4
        focusAreas: focus
    });

    return [
        buildPortrait('心脑血管系统', '🫀', findings.cv, ['动脉硬化', '高血压', '冠心病风险', '卒中风险']),
        buildPortrait('代谢免疫系统', '🩸', findings.meta, ['糖尿病', '痛风', '甲状腺功能', '中心性肥胖']),
        buildPortrait('呼吸系统', '🫁', findings.resp, ['肺结节管理', '慢阻肺(COPD)', '肺功能']),
        buildPortrait('消化系统', '🥔', findings.dig, ['脂肪肝', '肝硬化风险', '幽门螺杆菌', '胃肠息肉']),
        buildPortrait('肿瘤风险系统', '🧬', findings.tumor, ['肺癌筛查', '乳腺癌/妇科肿瘤', '消化道肿瘤']),
        buildPortrait('心理与精神', '🧠', findings.psych, ['压力调节', '焦虑抑郁风险', '睡眠障碍', '认知功能']),
    ];
};

/**
 * 2. 预测模型评估引擎
 * 模拟 14 个常用医学模型的计算逻辑。
 */
export const evaluateRiskModels = (record: HealthRecord): PredictionModelResult[] => {
    const models: PredictionModelResult[] = [];
    const extras = record.riskModelExtras || {};

    // Helper to get value securely from various parts of the record
    const getVal = (path: string) => {
        // 1. Try extras first (Manual input overrides)
        if (extras[path] !== undefined && extras[path] !== '') {
            const val = extras[path];
            return !isNaN(Number(val)) ? Number(val) : val;
        }
        
        // 2. Try structured record mapping
        switch(path) {
            case 'age': return record.profile.age;
            case 'gender': return record.profile.gender;
            case 'sbp': return record.checkup.basics.sbp;
            case 'bmi': return record.checkup.basics.bmi;
            case 'tc': return parseFloat(record.checkup.labBasic.lipids?.tc || '0') || undefined;
            case 'hdl': return parseFloat(record.checkup.labBasic.lipids?.hdl || '0') || undefined;
            case 'ldl': return parseFloat(record.checkup.labBasic.lipids?.ldl || '0') || undefined;
            case 'creatinine': return parseFloat(record.checkup.labBasic.renal?.creatinine || '0') || undefined;
            case 'ua': return parseFloat(record.checkup.labBasic.renal?.ua || '0') || undefined;
            case 'glucose': return parseFloat(record.checkup.labBasic.glucose?.fasting || '0') || undefined;
            case 'ast': return parseFloat(record.checkup.labBasic.liver?.AST || '0') || undefined;
            case 'alt': return parseFloat(record.checkup.labBasic.liver?.ALT || '0') || undefined;
            case 'alb': return parseFloat(record.checkup.labBasic.liver?.ALB || '0') || undefined;
            case 'smoking': return record.questionnaire.substances.smoking.status === '吸烟' ? '是' : '否';
            case 'diabetes': return record.questionnaire.history.diseases.some(d => d.includes('糖尿病')) ? '是' : '否';
            default: return undefined;
        }
    };

    // --- 1. China-PAR (心血管) ---
    const chinaParCalc = () => {
        const missing: {key:string, label:string}[] = [];
        const age = getVal('age') as number;
        const sbp = getVal('sbp') as number;
        const tc = getVal('tc') as number;
        const waist = getVal('waist') as number; // Extra
        const familyHistory = getVal('familyCv'); // Extra (是/否)

        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!sbp) missing.push({key: 'sbp', label: '收缩压'});
        if (!tc) missing.push({key: 'tc', label: '总胆固醇'});
        if (waist === undefined) missing.push({key: 'waist', label: '腰围(cm)'});
        if (familyHistory === undefined) missing.push({key: 'familyCv', label: '心血管病家族史(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量，无法计算' };

        // Mock Calculation Logic (Simplified)
        let riskScore = 0;
        if (age > 60) riskScore += 2;
        if (sbp > 140) riskScore += 2;
        if (tc > 6.0) riskScore += 1;
        if (getVal('smoking') === '是') riskScore += 1;
        if (getVal('diabetes') === '是') riskScore += 2;
        if (familyHistory === '是') riskScore += 1;
        if (waist && waist > 90) riskScore += 1;

        const level = riskScore >= 5 ? RiskLevel.RED : riskScore >= 3 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        const label = level === RiskLevel.RED ? '高风险' : level === RiskLevel.YELLOW ? '中风险' : '低风险';
        
        return { score: `${riskScore * 1.5}% (10年)`, riskLevel: level, riskLabel: label, missing: [], desc: `基于China-PAR模型预测，您未来10年发生心血管疾病的风险为 ${label}` };
    };

    // --- 2. ADA Diabetes (糖尿病) ---
    const adaCalc = () => {
        const missing = [];
        const bmi = getVal('bmi') as number;
        const famDb = getVal('familyDb'); // Extra
        const activity = getVal('physicalActivity'); // Extra
        
        if (!bmi) missing.push({key: 'bmi', label: 'BMI'});
        if (famDb === undefined) missing.push({key: 'familyDb', label: '糖尿病家族史(是/否)'});
        if (activity === undefined) missing.push({key: 'physicalActivity', label: '体力活动活跃(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        let score = 0;
        if ((getVal('age') as number) >= 40) score += 1;
        if (getVal('gender') === '男') score += 1;
        if (famDb === '是') score += 1;
        if ((getVal('sbp') as number) > 130) score += 1;
        if (activity === '否') score += 1;
        if (bmi > 24) score += 1;

        const level = score >= 5 ? RiskLevel.RED : score >= 4 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        return { score: `${score}分`, riskLevel: level, riskLabel: level===RiskLevel.RED?'高风险':level===RiskLevel.YELLOW?'中风险':'低风险', missing: [], desc: `ADA评分 ${score}分 (>=5分提示高危)` };
    };

    // --- 3. FRAX (骨折) ---
    const fraxCalc = () => {
        const missing = [];
        const prevFracture = getVal('prevFracture'); 
        const parentHip = getVal('parentHip'); 
        const steroids = getVal('steroids'); 

        if (prevFracture === undefined) missing.push({key: 'prevFracture', label: '既往骨折史(是/否)'});
        if (parentHip === undefined) missing.push({key: 'parentHip', label: '父母髋骨骨折史(是/否)'});
        if (steroids === undefined) missing.push({key: 'steroids', label: '长期使用激素(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };
        
        let risk = '低风险';
        let rLevel = RiskLevel.GREEN;
        if (prevFracture === '是' || parentHip === '是') { risk = '高风险'; rLevel = RiskLevel.RED; }
        else if ((getVal('age') as number) > 70 || steroids === '是') { risk = '中风险'; rLevel = RiskLevel.YELLOW; }

        return { score: 'NA', riskLevel: rLevel, riskLabel: risk as any, missing: [], desc: `基于FRAX关键因子，您的骨折风险评估为 ${risk}` };
    };

    // --- 4. KDIGO (慢性肾病) ---
    const kdigoCalc = () => {
        const missing = [];
        const age = getVal('age') as number;
        const gender = getVal('gender') as string;
        const scr = getVal('creatinine') as number; // umol/L
        const proteinuria = getVal('proteinuria'); // Extra: 尿蛋白定性 or ACR

        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!scr) missing.push({key: 'creatinine', label: '血肌酐(μmol/L)'});
        if (proteinuria === undefined) missing.push({key: 'proteinuria', label: '尿蛋白(阴性/阳性)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        // eGFR Calculation (Simplified MDRD/CKD-EPI approximation for demo)
        // eGFR = 186 * (Scr/88.4)^-1.154 * Age^-0.203 * (0.742 if female)
        let egfr = 186 * Math.pow(scr / 88.4, -1.154) * Math.pow(age, -0.203);
        if (gender === '女') egfr *= 0.742;
        egfr = Math.round(egfr);

        let stage = '';
        let level = RiskLevel.GREEN;

        if (egfr >= 90) stage = 'G1 (正常)';
        else if (egfr >= 60) stage = 'G2 (轻度降低)';
        else if (egfr >= 45) { stage = 'G3a (轻中度)'; level = RiskLevel.YELLOW; }
        else if (egfr >= 30) { stage = 'G3b (中重度)'; level = RiskLevel.YELLOW; }
        else { stage = 'G4/G5 (肾衰竭风险)'; level = RiskLevel.RED; }

        if (proteinuria === '阳性' && level === RiskLevel.GREEN) level = RiskLevel.YELLOW;

        return { 
            score: `eGFR: ${egfr}`, 
            riskLevel: level, 
            riskLabel: level === RiskLevel.RED ? '高风险' : level === RiskLevel.YELLOW ? '中风险' : '低风险', 
            missing: [], 
            desc: `KDIGO分期: ${stage}。${proteinuria === '阳性' ? '合并蛋白尿，风险增加。' : ''}` 
        };
    };
    
    // --- 5. Gastric Cancer (新型胃癌筛查评分) ---
    const gastricCalc = () => {
        const missing = [];
        const hp = getVal('hpStatus'); // Extra: 幽门螺杆菌
        const pgr = getVal('pgr'); // Extra: 胃蛋白酶原比值 (PGI/PGII)

        if (hp === undefined) missing.push({key: 'hpStatus', label: '幽门螺杆菌感染(是/否)'});
        if (pgr === undefined) missing.push({key: 'pgr', label: 'PGI/PGII 比值(<3为异常)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '建议进行Hp呼气试验及胃功能四项检查' };

        // A群: Hp(-) PG(-) -> 低危
        // B群: Hp(+) PG(-) -> 中危
        // C群: Hp(+) PG(+) -> 高危 (注意：PGR低为阳性)
        // D群: Hp(-) PG(+) -> 高危 (萎缩严重)
        
        let group = 'A群';
        let level = RiskLevel.GREEN;
        
        const isHpPos = hp === '是';
        const isPgPos = (pgr as number) < 3.0; // PGR low is bad

        if (!isHpPos && !isPgPos) { group = 'A群 (健康)'; level = RiskLevel.GREEN; }
        else if (isHpPos && !isPgPos) { group = 'B群 (主要因Hp感染)'; level = RiskLevel.YELLOW; }
        else if (isHpPos && isPgPos) { group = 'C群 (萎缩伴感染)'; level = RiskLevel.RED; }
        else if (!isHpPos && isPgPos) { group = 'D群 (严重萎缩)'; level = RiskLevel.RED; }

        return { score: group, riskLevel: level, riskLabel: level === 'RED' ? '高风险' : level === 'YELLOW' ? '中风险' : '低风险', missing: [], desc: `胃癌筛查分群: ${group}，建议${level === 'RED' ? '立即胃镜检查' : '定期随访'}` };
    };

    // --- 6. APCS (亚太结直肠癌筛查) ---
    const colorectalCalc = () => {
        const missing = [];
        const famColon = getVal('famColon'); // Extra

        if (famColon === undefined) missing.push({key: 'famColon', label: '一级亲属肠癌史(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        let score = 0;
        const age = getVal('age') as number;
        if (age >= 50 && age < 70) score += 2; // Simplified age score
        else if (age >= 70) score += 3;
        
        if (getVal('gender') === '男') score += 1;
        if (famColon === '是') score += 2;
        if (getVal('smoking') === '是') score += 1;

        const level = score >= 4 ? RiskLevel.RED : score >= 2 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        
        return { score: `${score}分`, riskLevel: level, riskLabel: level === 'RED' ? '高风险' : level === 'YELLOW' ? '中风险' : '低风险', missing: [], desc: `APCS评分 ${score}分，${level === 'RED' ? '强烈建议肠镜筛查' : '建议FIT便隐血测试'}` };
    };

    // --- 7. NAFLD Fibrosis Score (脂肪肝纤维化) ---
    const nafldCalc = () => {
        const missing = [];
        const plt = getVal('plt'); // Extra: 血小板
        const alb = getVal('alb'); // Albumin
        const ast = getVal('ast');
        const alt = getVal('alt');
        
        if (!plt) missing.push({key: 'plt', label: '血小板计数(10^9/L)'});
        if (!alb) missing.push({key: 'alb', label: '白蛋白(g/L)'});
        if (!ast) missing.push({key: 'ast', label: 'AST(U/L)'});
        if (!alt) missing.push({key: 'alt', label: 'ALT(U/L)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少肝功或血常规指标' };

        // NFS formula: -1.675 + 0.037*age + 0.094*BMI + 1.13*IFG/Diabetes(yes=1,no=0) + 0.99*AST/ALT - 0.013*PLT - 0.66*Alb
        const age = getVal('age') as number;
        const bmi = getVal('bmi') as number;
        const hasDb = getVal('diabetes') === '是' ? 1 : 0;
        
        const score = -1.675 + 0.037 * age + 0.094 * bmi + 1.13 * hasDb + 0.99 * ((ast as number)/(alt as number)) - 0.013 * (plt as number) - 0.66 * (alb as number);
        
        let level = RiskLevel.GREEN;
        let label = '低风险';
        if (score > 0.676) { level = RiskLevel.RED; label = '高风险(F3-F4)'; }
        else if (score > -1.455) { level = RiskLevel.YELLOW; label = '中风险'; }

        return { score: score.toFixed(2), riskLevel: level, riskLabel: label as any, missing: [], desc: `NFS评分 ${score.toFixed(2)}，提示肝纤维化风险: ${label}` };
    };

    // --- 8. SCL-90 (心理健康简筛) ---
    const mentalCalc = () => {
        // 由于 SCL-90 是90项量表，无法自动计算。此处模拟“简易心理筛查”。
        // 基于问卷中的压力、睡眠、焦虑关键词。
        const missing = [];
        const stress = getVal('stressSelf') || record.questionnaire.mental.stressLevel; // Q50
        const sleepQ = getVal('sleepQual') || record.questionnaire.sleep.quality; // Q35
        
        if (!stress) missing.push({key: 'stressSelf', label: '自我压力感(小/一般/大)'});
        if (!sleepQ) missing.push({key: 'sleepQual', label: '睡眠质量(好/一般/差)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少问卷数据' };

        let score = 0;
        if (stress === '较大' || stress === '很大') score += 2;
        if (sleepQ === '差') score += 2;
        else if (sleepQ === '一般') score += 1;

        const level = score >= 3 ? RiskLevel.RED : score >= 1 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        const label = level === 'RED' ? '需关注' : level === 'YELLOW' ? '一般' : '良好';

        return { score: 'NA', riskLevel: level, riskLabel: label as any, missing: [], desc: `基于压力与睡眠的心理初筛状态: ${label}` };
    };

    // --- 9. Gout (高尿酸/痛风) ---
    const goutCalc = () => {
        const ua = getVal('ua') as number;
        if (!ua) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing: [{key:'ua', label:'血尿酸(μmol/L)'}], desc: '缺少血尿酸值' };

        const gender = getVal('gender');
        let limit = gender === '男' ? 420 : 360;
        
        let level = RiskLevel.GREEN;
        let desc = '尿酸正常';

        if (ua > 540) { level = RiskLevel.RED; desc = '重度高尿酸，痛风风险极高'; }
        else if (ua > limit) { level = RiskLevel.YELLOW; desc = '高尿酸血症'; }

        return { score: `${ua}`, riskLevel: level, riskLabel: level===RiskLevel.RED?'高风险':level===RiskLevel.YELLOW?'中风险':'低风险', missing: [], desc };
    };
    
    // --- 10. Gail (乳腺癌 - 已有) ---
    const gailCalc = () => {
        if (getVal('gender') !== '女') return { score: 'NA', riskLevel: RiskLevel.GREEN, riskLabel: '一般' as const, missing: [], desc: '仅适用于女性' };
        const missing = [];
        const firstPeriod = getVal('firstPeriodAge'); 
        const firstBirth = getVal('firstBirthAge'); 
        const relativesBc = getVal('relativesBc'); 

        if (firstPeriod === undefined) missing.push({key: 'firstPeriodAge', label: '初潮年龄'});
        if (firstBirth === undefined) missing.push({key: 'firstBirthAge', label: '初次生育年龄(或未育)'});
        if (relativesBc === undefined) missing.push({key: 'relativesBc', label: '直系亲属乳腺癌史(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        let highRisk = relativesBc === '是';
        return { score: highRisk ? '>1.67%' : '<1.0%', riskLevel: highRisk ? RiskLevel.YELLOW : RiskLevel.GREEN, riskLabel: highRisk ? '中风险' : '低风险', missing: [], desc: `5年风险评估: ${highRisk ? '需关注' : '一般'}` };
    };
    
    // --- 11. COPD-SQ (慢阻肺 - 已有) ---
    const copdCalc = () => {
        const missing = [];
        const cough = getVal('chronicCough');
        if (getVal('smoking') === undefined) missing.push({key: 'smoking_status', label: '吸烟状态'}); 
        if (cough === undefined) missing.push({key: 'chronicCough', label: '经常咳嗽咳痰(是/否)'});
        
        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };
        
        let pts = 0;
        if ((getVal('age') as number) > 40) pts += 5;
        if (getVal('smoking') === '是') pts += 6;
        if (cough === '是') pts += 4;
        
        const r = pts > 16 ? RiskLevel.RED : RiskLevel.GREEN;
        return { score: `${pts}分`, riskLevel: r, riskLabel: r===RiskLevel.RED?'高风险':'低风险', missing: [], desc: `COPD-SQ 筛查得分` };
    };

    // Helper to build result
    const run = (id: string, name: string, cat: string, fn: Function): PredictionModelResult => {
        const res = fn();
        return {
            modelId: id,
            modelName: name,
            category: cat,
            score: res.score,
            riskLevel: res.riskLevel,
            riskLabel: res.riskLabel,
            description: res.desc,
            missingParams: res.missing,
            lastCalculated: new Date().toISOString()
        };
    };

    models.push(run('cv_chinapar', 'China-PAR 模型', '心脑血管', chinaParCalc));
    models.push(run('meta_ada', 'ADA 糖尿病风险', '代谢免疫', adaCalc));
    models.push(run('renal_kdigo', 'KDIGO 慢性肾病', '代谢免疫', kdigoCalc));
    models.push(run('meta_gout', '痛风/高尿酸风险', '代谢免疫', goutCalc));
    models.push(run('resp_copd', 'COPD-SQ 慢阻肺筛查', '呼吸系统', copdCalc));
    models.push(run('dig_nafld', 'NAFLD 肝纤维化评分', '消化系统', nafldCalc));
    models.push(run('tumor_gastric', '新型胃癌筛查评分', '肿瘤风险', gastricCalc));
    models.push(run('tumor_colon', '亚太结直肠癌评分', '肿瘤风险', colorectalCalc));
    models.push(run('tumor_gail', 'Gail 乳腺癌风险', '肿瘤风险', gailCalc));
    models.push(run('bone_frax', 'FRAX 骨折风险', '骨骼肌肉', fraxCalc));
    models.push(run('psych_scl', '心理健康初筛', '心理精神', mentalCalc));
    
    // Placeholder models (waiting for implementation or data)
    models.push({ modelId: 'cv_ascvd', modelName: 'ASCVD 风险', category: '心脑血管', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少LDL-C数据', missingParams: [{key:'ldl', label:'LDL-C'}], lastCalculated: '' });
    models.push({ modelId: 'tumor_lung', modelName: 'NLST 肺癌筛查', category: '肿瘤风险', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少吸烟包年数', missingParams: [{key:'packYears', label:'吸烟包年数'}], lastCalculated: '' });
    models.push({ modelId: 'psych_ad', modelName: 'ANU-ADRI 阿尔茨海默', category: '心理精神', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少认知自评', missingParams: [{key:'cogSelf', label:'记忆力减退自评'}], lastCalculated: '' });
    
    return models;
};
