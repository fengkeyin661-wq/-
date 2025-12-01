
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
 * 注意：由于真实医学模型计算极其复杂，此处使用基于规则的“预估逻辑”来模拟，核心在于检测变量缺失。
 */
export const evaluateRiskModels = (record: HealthRecord): PredictionModelResult[] => {
    const models: PredictionModelResult[] = [];
    const extras = record.riskModelExtras || {};

    // Helper to get value
    const getVal = (path: string, type: 'number' | 'string' = 'number') => {
        // Try extras first
        if (extras[path] !== undefined && extras[path] !== '') return extras[path];
        
        // Mapping common paths
        if (path === 'age') return record.profile.age;
        if (path === 'gender') return record.profile.gender;
        if (path === 'sbp') return record.checkup.basics.sbp;
        if (path === 'bmi') return record.checkup.basics.bmi;
        if (path === 'tc') return parseFloat(record.checkup.labBasic.lipids?.tc || '0');
        if (path === 'hdl') return parseFloat(record.checkup.labBasic.lipids?.hdl || '0');
        if (path === 'smoking') return record.questionnaire.substances.smoking.status === '吸烟';
        if (path === 'diabetes') return record.questionnaire.history.diseases.some(d => d.includes('糖尿病'));
        
        return undefined;
    };

    // --- 1. China-PAR (心血管) ---
    const chinaParCalc = () => {
        const missing: {key:string, label:string}[] = [];
        const age = getVal('age');
        const sbp = getVal('sbp');
        const tc = getVal('tc');
        const waist = getVal('waist'); // Extra
        const familyHistory = getVal('familyCv'); // Extra

        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!sbp) missing.push({key: 'sbp', label: '收缩压'});
        if (!tc) missing.push({key: 'tc', label: '总胆固醇'});
        if (waist === undefined) missing.push({key: 'waist', label: '腰围(cm)'});
        if (familyHistory === undefined) missing.push({key: 'familyCv', label: '心血管病家族史(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量，无法计算' };

        // Mock Calculation Logic
        let riskScore = 0;
        if (age > 60) riskScore += 2;
        if (sbp > 140) riskScore += 2;
        if (tc > 6.0) riskScore += 1;
        if (getVal('smoking')) riskScore += 1;
        if (getVal('diabetes')) riskScore += 2;
        if (familyHistory === '是') riskScore += 1;

        const level = riskScore >= 4 ? RiskLevel.RED : riskScore >= 2 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        const label = level === RiskLevel.RED ? '高风险' : level === RiskLevel.YELLOW ? '中风险' : '低风险';
        
        return { score: `${riskScore * 1.5}% (10年)`, riskLevel: level, riskLabel: label, missing: [], desc: `基于China-PAR模型预测，您未来10年发生心血管疾病的风险为 ${label}` };
    };

    // --- 2. ADA Diabetes (糖尿病) ---
    const adaCalc = () => {
        const missing = [];
        const bmi = getVal('bmi');
        const famDb = getVal('familyDb'); // Extra
        const activity = getVal('physicalActivity'); // Extra
        
        if (!bmi) missing.push({key: 'bmi', label: 'BMI'});
        if (famDb === undefined) missing.push({key: 'familyDb', label: '糖尿病家族史(是/否)'});
        if (activity === undefined) missing.push({key: 'physicalActivity', label: '体力活动活跃(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        let score = 0;
        if (getVal('age') >= 40) score += 1;
        if (getVal('gender') === '男') score += 1;
        if (famDb === '是') score += 1;
        if (getVal('sbp') > 130) score += 1;
        if (activity === '否') score += 1;
        if (bmi > 24) score += 1;

        const level = score >= 5 ? RiskLevel.RED : score >= 4 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        return { score: `${score}分`, riskLevel: level, riskLabel: level===RiskLevel.RED?'高风险':level===RiskLevel.YELLOW?'中风险':'低风险', missing: [], desc: `ADA评分 ${score}分，建议关注血糖代谢` };
    };

    // --- 3. FRAX (骨折) ---
    const fraxCalc = () => {
        const missing = [];
        const prevFracture = getVal('prevFracture'); // Extra
        const parentHip = getVal('parentHip'); // Extra
        const steroids = getVal('steroids'); // Extra

        if (prevFracture === undefined) missing.push({key: 'prevFracture', label: '既往骨折史(是/否)'});
        if (parentHip === undefined) missing.push({key: 'parentHip', label: '父母髋骨骨折史(是/否)'});
        if (steroids === undefined) missing.push({key: 'steroids', label: '长期使用激素(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };
        
        let risk = '低风险';
        let rLevel = RiskLevel.GREEN;
        if (prevFracture === '是' || parentHip === '是') { risk = '高风险'; rLevel = RiskLevel.RED; }
        else if (getVal('age') > 70 || steroids === '是') { risk = '中风险'; rLevel = RiskLevel.YELLOW; }

        return { score: 'NA', riskLevel: rLevel, riskLabel: risk as any, missing: [], desc: `基于FRAX因子评估，骨折风险为${risk}` };
    };
    
    // --- 4. Gail Model (乳腺癌) - Female Only ---
    const gailCalc = () => {
        if (getVal('gender') !== '女') return { score: 'NA', riskLevel: RiskLevel.GREEN, riskLabel: '一般' as const, missing: [], desc: '仅适用于女性' };
        
        const missing = [];
        const firstPeriod = getVal('firstPeriodAge'); // Extra
        const firstBirth = getVal('firstBirthAge'); // Extra
        const relativesBc = getVal('relativesBc'); // Extra

        if (firstPeriod === undefined) missing.push({key: 'firstPeriodAge', label: '初潮年龄'});
        if (firstBirth === undefined) missing.push({key: 'firstBirthAge', label: '初次生育年龄(或未育)'});
        if (relativesBc === undefined) missing.push({key: 'relativesBc', label: '直系亲属乳腺癌史(是/否)'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };

        let highRisk = false;
        if (relativesBc === '是') highRisk = true;
        
        return { score: highRisk ? '>1.67%' : '<1.0%', riskLevel: highRisk ? RiskLevel.YELLOW : RiskLevel.GREEN, riskLabel: highRisk ? '中风险' : '低风险', missing: [], desc: `5年浸润性乳腺癌风险评估: ${highRisk ? '需关注' : '一般'}` };
    };

    // --- 5. COPD-SQ (慢阻肺) ---
    const copdCalc = () => {
        const missing = [];
        const cough = getVal('chronicCough');
        
        if (getVal('smoking') === undefined) missing.push({key: 'smoking_status', label: '吸烟状态'}); // usually in profile but strictly check
        if (cough === undefined) missing.push({key: 'chronicCough', label: '经常咳嗽咳痰(是/否)'});
        
        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少关键变量' };
        
        let pts = 0;
        if (getVal('age') > 40) pts += 5;
        if (getVal('smoking')) pts += 6;
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
    models.push(run('bone_frax', 'FRAX 骨折风险', '骨骼肌肉', fraxCalc));
    models.push(run('resp_copd', 'COPD-SQ 慢阻肺筛查', '呼吸系统', copdCalc));
    models.push(run('tumor_gail', 'Gail 乳腺癌风险', '肿瘤风险', gailCalc));

    // Placeholders for others to demonstrate matrix (Simplified logic for brevity)
    models.push({ modelId: 'meta_cds', modelName: 'CDS 代谢综合征', category: '代谢免疫', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少腰围数据', missingParams: [{key:'waist', label:'腰围'}], lastCalculated: '' });
    models.push({ modelId: 'cv_ascvd', modelName: 'ASCVD 风险', category: '心脑血管', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少LDL-C数据', missingParams: [{key:'ldl', label:'LDL-C'}], lastCalculated: '' });
    models.push({ modelId: 'tumor_lung', modelName: 'NLST 肺癌筛查', category: '肿瘤风险', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少吸烟包年数', missingParams: [{key:'packYears', label:'吸烟包年数'}], lastCalculated: '' });
    models.push({ modelId: 'tumor_gi', modelName: '亚太结直肠癌评分', category: '肿瘤风险', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少家族肠癌史', missingParams: [{key:'famColon', label:'一级亲属肠癌史'}], lastCalculated: '' });
    models.push({ modelId: 'psych_ad', modelName: 'ANU-ADRI 阿尔茨海默', category: '心理精神', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少认知自评', missingParams: [{key:'cogSelf', label:'记忆力减退自评'}], lastCalculated: '' });
    models.push({ modelId: 'meta_gout', modelName: '痛风 10年风险', category: '代谢免疫', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少血尿酸值', missingParams: [{key:'ua', label:'血尿酸'}], lastCalculated: '' });
    models.push({ modelId: 'dig_nafld', modelName: 'NAFLD 纤维化评分', category: '消化系统', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '缺少血小板计数', missingParams: [{key:'plt', label:'血小板计数'}], lastCalculated: '' });
    
    return models;
};
