
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

    // 2. Scan Questionnaire (Legacy & New)
    record.questionnaire.history.diseases.forEach(d => {
        if (d.includes('高血压') || d.includes('冠心病') || d.includes('卒中')) add('cv', `既往史: ${d}`);
        if (d.includes('糖尿病') || d.includes('痛风') || d.includes('甲状腺')) add('meta', `既往史: ${d}`);
        if (d.includes('慢肺') || d.includes('哮喘')) add('resp', `既往史: ${d}`);
        if (d.includes('胃病') || d.includes('脂肪肝')) add('dig', `既往史: ${d}`);
        if (d.includes('肿瘤')) add('tumor', `既往史: ${d}`);
    });
    
    // Mental Scales Integration
    const { phq9Score, gad7Score, selfHarmIdea } = record.questionnaire.mentalScales || {};
    if (phq9Score && phq9Score >= 5) add('psych', `PHQ-9抑郁评分:${phq9Score}`);
    if (gad7Score && gad7Score >= 5) add('psych', `GAD-7焦虑评分:${gad7Score}`);
    if (selfHarmIdea && selfHarmIdea > 0) add('psych', `存在自伤念头 (高危)`);

    // 3. Construct Portraits
    const buildPortrait = (name: string, icon: string, keyItems: string[], focus: string[]): SystemRiskPortrait => ({
        systemName: name,
        icon,
        status: keyItems.length > 2 || (name === '心理与精神' && (selfHarmIdea || 0) > 0) ? 'High' : keyItems.length > 0 ? 'Medium' : 'Normal',
        keyFindings: keyItems.slice(0, 4), 
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
    const q = record.questionnaire;

    // Helper: Safely parse float from string
    const safeFloat = (val: string | undefined | null): number | undefined => {
        if (!val) return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
    };

    // Helper: Smart Get Value
    const getVal = (key: string): any => {
        // 1. Manual override from riskModelExtras (UI Input)
        if (extras[key] !== undefined && extras[key] !== '') return extras[key];

        // 2. Structured mappings from Health Record
        switch(key) {
            case 'age': return record.profile.age;
            case 'gender': return record.profile.gender;
            case 'sbp': return record.checkup.basics.sbp;
            case 'bmi': return record.checkup.basics.bmi;
            case 'tc': return safeFloat(record.checkup.labBasic.lipids?.tc);
            case 'waist': return record.checkup.basics.waist;
            case 'isSmoking': return q.substances.smoking.status === '吸烟' || q.substances.smoking.status === '目前吸烟' ? true : false;
            case 'hasDiabetes': return q.history.diseases.some(d => d.includes('糖尿病')) || q.history.details.diabetesYear ? true : false;
            case 'takingBpMeds': return q.medication.details.antihypertensive;
            // China-PAR specific
            case 'north': return true; // Default to North per request
            case 'familyCvd': return q.familyHistory.fatherCvdEarly || q.familyHistory.motherCvdEarly || q.familyHistory.stroke;
            
            // ADA specific
            case 'familyDb': return q.familyHistory.diabetes;
            case 'gdm': return q.femaleHealth.gdmHistory;
            case 'pcos': return q.femaleHealth.pcosHistory;
            case 'takingBpMedsBoolean': return q.medication.details.antihypertensive === true;
            
            // FRAX specific
            case 'parentHip': return q.familyHistory.parentHipFracture;
            case 'steroids': return q.medication.details.steroids;
            case 'ra': 
                // Check questionnaire history for "Rheumatoid" OR check RF Lab value
                return q.history.diseases.some(d => d.includes('类风湿')) || (record.checkup.optional.rheumatoid?.rf && parseFloat(record.checkup.optional.rheumatoid.rf) > 20);

            // COPD & Lung Cancer specific
            case 'packYears': 
                const py = q.substances.smoking.packYears;
                if (py !== undefined && py !== null && py > 0) return py;
                // Fallback calc: (Daily / 20) * Years
                const daily = q.substances.smoking.dailyAmount;
                const years = q.substances.smoking.years;
                if (daily && years) return (daily / 20) * years;
                return undefined;

            case 'chronicCough': return q.respiratory.chronicCough;
            case 'chronicPhlegm': return q.respiratory.chronicPhlegm;
            case 'shortBreath': return q.respiratory.shortBreath;
            
            // Gail specific
            case 'menarcheAge': return q.femaleHealth.menarcheAge;
            case 'firstBirthAge': return q.femaleHealth.firstBirthAge;
            case 'breastBiopsy': return q.femaleHealth.breastBiopsy;
            case 'familyBc': return q.familyHistory.breastCancer;
            
            // Colon
            case 'colonCancer': return q.familyHistory.colonCancer;

            // NAFLD Specific (Enhanced Extraction)
            case 'ast': return safeFloat(record.checkup.labBasic.liver?.AST) || safeFloat(record.checkup.labBasic.liver?.ast);
            case 'alt': return safeFloat(record.checkup.labBasic.liver?.ALT) || safeFloat(record.checkup.labBasic.liver?.alt);
            case 'plt': return safeFloat(record.checkup.labBasic.bloodRoutine?.plt);
            case 'alb': return safeFloat(record.checkup.labBasic.liver?.ALB) || safeFloat(record.checkup.labBasic.liver?.alb);

            // Gastric Specific (Enhanced Extraction from C13 or Gastric text)
            case 'hp': 
                // 1. Check C13 breath test
                const c13 = record.checkup.optional.c13 || '';
                if (c13.includes('阳性') || c13.includes('+')) return '阳性';
                if (c13.includes('阴性') || c13.includes('-')) return '阴性';
                // 2. Check History
                if (q.history.diseases.some(d => d.includes('幽门'))) return '阳性';
                return undefined;

            case 'pgr': // Pepsinogen I/II Ratio
                // Try to extract from gastrin text block if unstructured
                const gastrinTxt = record.checkup.optional.gastrin || '';
                // Regex for "PGR: 4.2" or "比值: 4.2"
                const pgrMatch = gastrinTxt.match(/(?:PGR|比值)[:\s=]*(\d+(\.\d+)?)/i);
                return pgrMatch ? parseFloat(pgrMatch[1]) : undefined;

            case 'g17': // Gastrin-17
                const g17Txt = record.checkup.optional.gastrin || '';
                const g17Match = g17Txt.match(/(?:G-?17|胃泌素-?17)[:\s=]*(\d+(\.\d+)?)/i);
                return g17Match ? parseFloat(g17Match[1]) : undefined;

            default: return undefined;
        }
    };

    // --- 1. China-PAR (心血管 - 北方版) ---
    const chinaParCalc = () => {
        const missing = [];
        const age = getVal('age');
        const sbp = getVal('sbp');
        const tc = getVal('tc');
        const waist = getVal('waist');
        
        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!sbp) missing.push({key: 'sbp', label: '收缩压'});
        if (!tc) missing.push({key: 'tc', label: 'TC'}); // Shortened from 总胆固醇
        if (!waist) missing.push({key: 'waist', label: '腰围'}); // Shortened

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少体检基础数据' };

        // Simplified Point Scoring mimicking China-PAR (North)
        let score = 0;
        // Age
        if (age >= 40) score += 1;
        if (age >= 50) score += 2;
        if (age >= 60) score += 3;
        // SBP
        if (sbp >= 130) score += 1;
        if (sbp >= 140) score += 2;
        if (sbp >= 160) score += 3;
        // TC
        if (tc >= 5.2) score += 1;
        if (tc >= 6.2) score += 2;
        // Waist (M>90, F>85)
        const isMale = getVal('gender') === '男';
        if (waist >= (isMale ? 90 : 85)) score += 1;
        // Factors
        if (getVal('isSmoking')) score += 1;
        if (getVal('hasDiabetes')) score += 1;
        if (getVal('familyCvd')) score += 1;
        if (getVal('north')) score += 1; // Region risk

        const level = score >= 8 ? RiskLevel.RED : score >= 5 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        const label = level === 'RED' ? '高风险' : level === 'YELLOW' ? '中风险' : '低风险';
        
        return { score: `${score}分`, riskLevel: level, riskLabel: label, missing: [], desc: `基于China-PAR(北方版)因子评分: ${score}分` };
    };

    // --- 2. ADA Diabetes (糖尿病) ---
    const adaCalc = () => {
        const missing = [];
        const age = getVal('age');
        const bmi = getVal('bmi');
        
        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!bmi) missing.push({key: 'bmi', label: 'BMI'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少基础数据' };

        let score = 0;
        if (age >= 40) score += 1;
        if (age >= 50) score += 2;
        if (age >= 60) score += 3;
        
        if (getVal('gender') === '男') score += 1;
        if (getVal('familyDb')) score += 1;
        if (getVal('takingBpMedsBoolean')) score += 1; // High BP treatment
        if (bmi >= 24) score += 1;
        if (bmi >= 28) score += 2;
        
        // Female specific
        if (getVal('gdm')) score += 1;

        const level = score >= 5 ? RiskLevel.RED : score >= 4 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        return { score: `${score}分`, riskLevel: level, riskLabel: level==='RED'?'高风险':level==='YELLOW'?'中风险':'低风险', missing: [], desc: `ADA风险评分: ${score}分 (≥5分高危)` };
    };

    // --- 3. FRAX (骨折) ---
    const fraxCalc = () => {
        const missing = [];
        const parentHip = getVal('parentHip');
        const steroids = getVal('steroids');

        if (parentHip === undefined) missing.push({key: 'parentHip', label: '父母髋骨骨折'});
        if (steroids === undefined) missing.push({key: 'steroids', label: '激素史'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少问卷关键因子' };
        
        let risk = '低风险';
        let rLevel = RiskLevel.GREEN;
        
        // Simplified Logic without Fracture Index Tool
        if (parentHip || (getVal('ra') && getVal('age') > 60)) {
             risk = '高风险'; rLevel = RiskLevel.RED;
        } else if (steroids || getVal('age') > 70) {
             risk = '中风险'; rLevel = RiskLevel.YELLOW;
        }

        return { score: 'NA', riskLevel: rLevel, riskLabel: risk as any, missing: [], desc: `基于FRAX因子评估: ${risk}` };
    };

    // --- 4. COPD-SQ (慢阻肺) ---
    const copdCalc = () => {
        const missing = [];
        const packYears = getVal('packYears'); // from AI or Calc
        const cough = getVal('chronicCough');
        
        if (packYears === undefined && getVal('isSmoking') === undefined) missing.push({key: 'packYears', label: '包年数'});
        if (cough === undefined) missing.push({key: 'chronicCough', label: '咳嗽症状'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '需完善呼吸道症状/吸烟史' };

        let score = 0;
        const age = getVal('age');
        
        // Age
        if (age >= 40 && age < 50) score += 2;
        if (age >= 50 && age < 60) score += 4;
        if (age >= 60) score += 6;
        
        // Smoking
        if (packYears) {
            if (packYears >= 5 && packYears < 15) score += 3;
            if (packYears >= 15 && packYears < 25) score += 4;
            if (packYears >= 25) score += 6;
        } else if (getVal('isSmoking')) {
            score += 3; // minimal score for current smoker unknown amount
        }
        
        // Symptoms
        if (cough) score += 2;
        if (getVal('chronicPhlegm')) score += 2;
        if (getVal('shortBreath')) score += 3;
        
        const r = score >= 16 ? RiskLevel.RED : RiskLevel.GREEN;
        return { score: `${score}分`, riskLevel: r, riskLabel: r===RiskLevel.RED?'高风险':'低风险', missing: [], desc: `COPD-SQ得分: ${score} (≥16高危)` };
    };

    // --- 5. Gail (乳腺癌) ---
    const gailCalc = () => {
        // Condition: Only for females
        if (getVal('gender') !== '女') return null; // Return null to indicate N/A
        
        const missing = [];
        const menarche = getVal('menarcheAge');
        const firstBirthStr = getVal('firstBirthAge'); // string "<20", etc.
        const biopsy = getVal('breastBiopsy');
        const familyBc = getVal('familyBc');

        if (!menarche) missing.push({key: 'menarcheAge', label: '初潮'});
        if (!firstBirthStr) missing.push({key: 'firstBirthAge', label: '首胎'});
        if (biopsy === undefined) missing.push({key: 'breastBiopsy', label: '活检'});
        if (familyBc === undefined) missing.push({key: 'familyBc', label: '家族史'});

        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少女性健康史' };

        let riskFactor = 0;
        if (menarche < 12) riskFactor += 1;
        if (firstBirthStr === '≥30岁' || firstBirthStr === '未生育') riskFactor += 1;
        if (familyBc) riskFactor += 2;
        if (biopsy) riskFactor += 1;

        const level = riskFactor >= 3 ? RiskLevel.RED : riskFactor >= 1 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        return { score: `${riskFactor}因子`, riskLevel: level, riskLabel: level==='RED'?'高风险':level==='YELLOW'?'中风险':'低风险', missing: [], desc: `Gail模型风险因子数: ${riskFactor}` };
    };

    // --- 6. Mental (PHQ-9/GAD-7) ---
    const mentalCalc = () => {
        const phq = q.mentalScales.phq9Score;
        const gad = q.mentalScales.gad7Score;
        const harm = q.mentalScales.selfHarmIdea || 0;

        // Fix: Explicitly check for null or undefined. A value of 0 is valid, but null is missing.
        if (phq === undefined || phq === null || gad === undefined || gad === null) {
             return { 
                 score: '-', 
                 riskLevel: 'UNKNOWN' as const, 
                 riskLabel: '待完善' as const, 
                 missing: [{key:'mental_survey', label:'健康问卷'}], 
                 desc: '请补全健康问卷' 
             };
        }

        let level = RiskLevel.GREEN;
        let label = '良好';
        let desc = '';

        if (harm > 0) {
            level = RiskLevel.RED;
            label = '高危预警';
            desc = '存在自伤念头，需立即干预！';
        } else if (phq >= 15 || gad >= 15) {
            level = RiskLevel.RED;
            label = '重度风险';
            desc = `PHQ-9:${phq}, GAD-7:${gad} (重度)`;
        } else if (phq >= 10 || gad >= 10) {
            level = RiskLevel.YELLOW;
            label = '中度风险';
            desc = `PHQ-9:${phq}, GAD-7:${gad} (中度)`;
        } else {
            desc = `PHQ-9:${phq}, GAD-7:${gad} (正常)`;
        }

        return { score: `${phq}/${gad}`, riskLevel: level, riskLabel: label as any, missing: [], desc };
    };

    // --- 7. APCS (结直肠癌) ---
    const colonCalc = () => {
        const missing = [];
        if (getVal('colonCancer') === undefined) missing.push({key: 'colonCancer', label: '家族史'});
        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '缺少家族史' };

        let score = 0;
        const age = getVal('age');
        if (age >= 50 && age < 70) score += 2;
        if (age >= 70) score += 3;
        if (getVal('gender') === '男') score += 1;
        if (q.familyHistory.colonCancer) score += 2;
        if (getVal('isSmoking')) score += 1;

        const r = score >= 4 ? RiskLevel.RED : score >= 2 ? RiskLevel.YELLOW : RiskLevel.GREEN;
        return { score: `${score}分`, riskLevel: r, riskLabel: r==='RED'?'高风险':r==='YELLOW'?'中风险':'低风险', missing: [], desc: `APCS评分: ${score}` };
    };

    // --- 8. NLST (肺癌筛查) ---
    const nlstCalc = () => {
        const missing = [];
        const age = getVal('age');
        const packYears = getVal('packYears');
        const isSmoking = getVal('isSmoking'); 
        const quitYearStr = q.substances.smoking.quitYear;
        
        if (!age) missing.push({key: 'age', label: '年龄'});
        if (packYears === undefined) missing.push({key: 'packYears', label: '包年数'});
        
        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '需吸烟量细节' };

        // NLST Criteria: Age 55-74, Pack-years >= 30, Current smoker or Quit <= 15 years ago
        if (age < 50) return { score: 'NA', riskLevel: RiskLevel.GREEN, riskLabel: '低风险' as const, missing: [], desc: '年龄<50岁' };

        let criteria = 0;
        if (age >= 55 && age <= 74) criteria++;
        if (packYears && packYears >= 30) criteria++;
        
        let smokingCriteria = false;
        if (isSmoking) {
            smokingCriteria = true;
        } else if (quitYearStr) {
            const qYear = parseInt(quitYearStr.replace(/[^0-9]/g, ''));
            const currentYear = new Date().getFullYear();
            if (!isNaN(qYear) && (currentYear - qYear) <= 15) {
                smokingCriteria = true;
            }
        }

        if (smokingCriteria) criteria++;

        if (criteria === 3) {
             return { score: '符合', riskLevel: RiskLevel.RED, riskLabel: '高风险' as const, missing: [], desc: '符合NLST高危筛查标准(建议LDCT)' };
        }
        
        return { score: '不符合', riskLevel: RiskLevel.GREEN, riskLabel: '一般' as const, missing: [], desc: '未达NLST高危标准' };
    };

    // --- 9. NAFLD Fibrosis Score (肝纤维化) ---
    const nafldCalc = () => {
        const missing = [];
        const age = getVal('age');
        const bmi = getVal('bmi');
        const diabetes = getVal('hasDiabetes');
        const ast = getVal('ast');
        const alt = getVal('alt');
        const plt = getVal('plt');
        const alb = getVal('alb');

        if (!age) missing.push({key: 'age', label: '年龄'});
        if (!bmi) missing.push({key: 'bmi', label: 'BMI'});
        if (ast === undefined) missing.push({key: 'ast', label: 'AST'}); // Shortened
        if (alt === undefined) missing.push({key: 'alt', label: 'ALT'}); // Shortened
        if (plt === undefined) missing.push({key: 'plt', label: 'PLT'}); // Shortened
        if (alb === undefined) missing.push({key: 'alb', label: '白蛋白'}); // Shortened

        if (missing.length > 0) return { score: 'NA', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '需完善生化/血常规指标' };

        // NFS Formula
        const ratio = ast / alt;
        const scoreVal = -1.675 + (0.037 * age) + (0.094 * bmi) + (1.13 * (diabetes ? 1 : 0)) + (0.99 * ratio) - (0.013 * plt) - (0.66 * alb);
        const fixedScore = scoreVal.toFixed(2);

        let level = RiskLevel.GREEN;
        let label = '低风险';
        
        if (scoreVal > 0.676) {
            level = RiskLevel.RED;
            label = '高风险';
        } else if (scoreVal > -1.455) {
            level = RiskLevel.YELLOW;
            label = '中风险'; // Indeterminate
        }

        return { score: fixedScore, riskLevel: level, riskLabel: label as any, missing: [], desc: `NFS评分: ${fixedScore}` };
    };

    // --- 10. Gastric Cancer Screening (胃癌) ---
    const gastricCalc = () => {
        const missing = [];
        const hp = getVal('hp'); // 阳性/阴性/数值
        const pgr = getVal('pgr'); // PGR value
        const g17 = getVal('g17'); // G-17 value

        if (hp === undefined) missing.push({key: 'hp', label: 'Hp感染'}); // Shortened
        if (pgr === undefined) missing.push({key: 'pgr', label: 'PGR'}); // Shortened
        if (g17 === undefined) missing.push({key: 'g17', label: 'G-17'}); // Shortened

        if (missing.length > 0) return { score: 'NA', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '需完善血清胃功能检测' };

        // ABC Method Logic (Simplified)
        // A: Hp(-), PG(-) -> Low
        // B: Hp(+), PG(-) -> Low-Med
        // C: Hp(+), PG(+) -> Med-High
        // D: Hp(-), PG(+) -> High
        // Definition of PG(+): PGR < 3.0 (Atrophy)
        
        const isHpPos = hp === '是' || hp === '阳性' || hp === true;
        const isPgPos = Number(pgr) < 3.0; // Atrophy indicator

        let risk = '低风险';
        let level = RiskLevel.GREEN;

        if (!isHpPos && !isPgPos) {
            risk = 'A群 (低风险)';
        } else if (isHpPos && !isPgPos) {
            risk = 'B群 (中低风险)';
            level = RiskLevel.YELLOW;
        } else if (isHpPos && isPgPos) {
            risk = 'C群 (中高风险)';
            level = RiskLevel.RED;
        } else if (!isHpPos && isPgPos) {
            risk = 'D群 (高风险)';
            level = RiskLevel.RED;
        }

        return { score: risk.split(' ')[0], riskLevel: level, riskLabel: level==='RED'?'高风险':level==='YELLOW'?'中风险':'低风险', missing: [], desc: `新型胃癌筛查: ${risk}` };
    };

    // Execute
    // Re-use helper
    const run = (id: string, name: string, cat: string, fn: Function): PredictionModelResult | null => {
        const res = fn();
        if (res === null) return null; // Skip if model not applicable
        return {
            modelId: id, modelName: name, category: cat, score: res.score, riskLevel: res.riskLevel, 
            riskLabel: res.riskLabel, description: res.desc, missingParams: res.missing, lastCalculated: new Date().toISOString()
        };
    };

    // Push valid models
    const results = [
        run('cv_chinapar', 'China-PAR 心脑血管病', '心脑血管', chinaParCalc),
        run('meta_ada', 'ADA 糖尿病风险', '代谢免疫', adaCalc),
        run('bone_frax', 'FRAX 骨折风险', '骨骼肌肉', fraxCalc),
        run('resp_copd', 'COPD-SQ 慢阻肺筛查', '呼吸系统', copdCalc),
        run('dig_nafld', 'NAFLD 肝纤维化评分', '消化系统', nafldCalc), // Active
        run('tumor_gail', 'Gail 乳腺癌风险', '肿瘤风险', gailCalc),
        run('tumor_nlst', 'NLST 肺癌筛查', '肿瘤风险', nlstCalc),
        run('tumor_gastric', '新型胃癌筛查 (ABC法)', '肿瘤风险', gastricCalc), // Active
        run('psych_scales', '心理健康 (PHQ/GAD)', '心理精神', mentalCalc),
        run('tumor_colon', '亚太结直肠癌评分', '肿瘤风险', colonCalc),
    ];

    // Filter out nulls
    return results.filter(m => m !== null) as PredictionModelResult[];
};
