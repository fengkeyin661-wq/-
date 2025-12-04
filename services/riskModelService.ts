
import { HealthRecord, RiskAnalysisData, SystemRiskPortrait, PredictionModelResult, RiskLevel } from '../types';

/**
 * 1. 生成 6 大系统健康画像 (升级版: 增加评分权重与关联分析)
 * 逻辑:
 * - 每个系统初始 100 分。
 * - 根据异常项的严重程度扣分 (Critical -30, Major -15, Minor -5)。
 * - 关联生活方式因素。
 */
export const generateSystemPortraits = (record: HealthRecord): SystemRiskPortrait[] => {
    // Structure: items, lifestyle factors, score deduction
    const systems: {[key: string]: { 
        name: string, icon: string, 
        findings: string[], 
        deduction: number,
        lifestyle: string[],
        focus: string[]
    }} = {
        cv: { name: '心脑血管系统', icon: '🫀', findings: [], deduction: 0, lifestyle: [], focus: [] },
        meta: { name: '代谢免疫系统', icon: '🩸', findings: [], deduction: 0, lifestyle: [], focus: [] },
        resp: { name: '呼吸系统', icon: '🫁', findings: [], deduction: 0, lifestyle: [], focus: [] },
        dig: { name: '消化系统', icon: '🥔', findings: [], deduction: 0, lifestyle: [], focus: [] },
        tumor: { name: '肿瘤风险监控', icon: '🧬', findings: [], deduction: 0, lifestyle: [], focus: [] },
        psych: { name: '心理与睡眠', icon: '🧠', findings: [], deduction: 0, lifestyle: [], focus: [] }
    };

    // Helper: Add finding with weighted score
    const addFinding = (sysKey: string, text: string, severity: 'low' | 'med' | 'high' = 'low') => {
        if (!systems[sysKey]) return;
        
        // Avoid duplicates
        if (!systems[sysKey].findings.includes(text)) {
            systems[sysKey].findings.push(text);
            const score = severity === 'high' ? 30 : severity === 'med' ? 15 : 5;
            systems[sysKey].deduction += score;
        }
    };

    // Helper: Add lifestyle factor
    const addLifestyle = (sysKey: string, text: string) => {
        if (!systems[sysKey].lifestyle.includes(text)) systems[sysKey].lifestyle.push(text);
    };

    // --- 1. Objective Data Analysis (Checkup) ---
    const ab = record.checkup.abnormalities || [];
    ab.forEach(item => {
        const t = (item.item + item.result + item.clinicalSig).toLowerCase();
        
        // [CV] Heart & Brain
        if (t.includes('血压') && (t.includes('高') || t.includes('140') || t.includes('180'))) addFinding('cv', item.item + ': ' + item.result, t.includes('3级') || t.includes('180') ? 'high' : 'med');
        else if (t.includes('心律') || t.includes('房颤') || t.includes('st段') || t.includes('缺血')) addFinding('cv', item.item + '异常', 'med');
        else if (t.includes('动脉硬化') || t.includes('斑块')) addFinding('cv', '动脉粥样硬化', 'med');
        
        // [Meta] Diabetes, Gout, Thyroid, Obesity
        if (t.includes('血糖') || t.includes('糖化')) addFinding('meta', '血糖代谢异常', 'med');
        else if (t.includes('尿酸') || t.includes('痛风')) addFinding('meta', '高尿酸/痛风风险', 'low');
        else if (t.includes('血脂') || t.includes('胆固醇') || t.includes('甘油三酯')) addFinding('meta', '血脂代谢异常', 'low');
        else if (t.includes('甲状腺') && (t.includes('功能') || t.includes('t3') || t.includes('tsh'))) addFinding('meta', '甲状腺功能异常', 'med');
        else if (t.includes('肥胖') || t.includes('超重')) addFinding('meta', '超重/肥胖', 'low');

        // [Resp] Lungs
        if (t.includes('肺结节')) addFinding('resp', '肺结节', 'med');
        else if (t.includes('肺功能') || t.includes('阻塞')) addFinding('resp', '肺功能减退', 'med');
        else if (t.includes('肺纹理') || t.includes('纤维灶')) addFinding('resp', '肺部影像异常', 'low');

        // [Dig] Liver, Stomach, Intestine
        if (t.includes('脂肪肝')) addFinding('dig', '脂肪肝', 'low');
        else if (t.includes('肝囊肿') || t.includes('血管瘤')) addFinding('dig', '肝脏良性占位', 'low');
        else if (t.includes('幽门') || t.includes('hp')) addFinding('dig', '幽门螺杆菌阳性', 'med');
        else if (t.includes('胆结石') || t.includes('息肉')) addFinding('dig', '胆囊/胃肠息肉结石', 'low');
        else if (t.includes('转氨酶') || t.includes('alt') || t.includes('ast')) addFinding('dig', '肝功能异常', 'med');

        // [Tumor] Markers & Mass
        if (t.includes('癌') || t.includes('ca1') || t.includes('cea') || t.includes('afp')) addFinding('tumor', item.item + '升高', 'high');
        else if (t.includes('bi-rads') && (t.includes('4') || t.includes('5'))) addFinding('tumor', '乳腺/甲状腺分类较高', 'high');
        else if (t.includes('bi-rads 3')) addFinding('tumor', '乳腺/甲状腺结节(3类)', 'med');

        // [Psych] Sleep & Mental (Usually questionnaire, but some physiology)
    });

    // --- 2. Subjective Data Analysis (Questionnaire) ---
    const q = record.questionnaire;
    
    // Lifestyle Links
    const isSmoker = q.substances.smoking.status === '吸烟' || q.substances.smoking.status === '目前吸烟';
    const isDrinker = q.substances.alcohol.status === '目前饮酒' && (q.substances.alcohol.freq === '每天' || q.substances.alcohol.freq === '经常');
    const badSleep = q.sleep.quality === '较差' || (Number(q.sleep.hours) < 6 && Number(q.sleep.hours) > 0);
    const stress = q.mental.stressLevel === '较大' || q.mental.stressLevel === '很大';
    const noExercise = q.exercise.frequency === '几乎不运动';
    const poorDiet = q.diet.habits.includes('偏咸') || q.diet.habits.includes('偏油');

    if (isSmoker) {
        addLifestyle('cv', '吸烟增加血管硬化风险');
        addLifestyle('resp', '吸烟损害肺功能');
        addLifestyle('tumor', '吸烟增加致癌风险');
    }
    if (isDrinker) {
        addLifestyle('dig', '饮酒加重肝脏负担');
        addLifestyle('cv', '饮酒影响血压控制');
    }
    if (badSleep) {
        addLifestyle('cv', '睡眠不足增加心脏负荷');
        addLifestyle('psych', '睡眠障碍影响情绪');
    }
    if (stress) {
        addLifestyle('cv', '高压力导致血压波动');
        addLifestyle('psych', '长期压力易致焦虑抑郁');
    }
    if (noExercise) {
        addLifestyle('meta', '缺乏运动降低代谢率');
        addLifestyle('cv', '缺乏运动减弱心肺功能');
    }
    if (poorDiet) {
        addLifestyle('cv', '高盐高油饮食加重高血压');
        addLifestyle('meta', '不健康饮食导致代谢紊乱');
    }

    // History Links
    q.history.diseases.forEach(d => {
        if (d.includes('高血压')) addFinding('cv', '既往史:高血压', 'high');
        if (d.includes('糖尿病')) addFinding('meta', '既往史:糖尿病', 'high');
        if (d.includes('冠心病')) addFinding('cv', '既往史:冠心病', 'high');
        if (d.includes('慢肺') || d.includes('copd')) addFinding('resp', '既往史:慢阻肺', 'high');
        if (d.includes('肿瘤')) addFinding('tumor', `既往史:${d}`, 'high');
    });

    // Mental Scales
    const { phq9Score, gad7Score, selfHarmIdea } = q.mentalScales || {};
    if ((phq9Score || 0) >= 10) addFinding('psych', '抑郁倾向(PHQ-9)', 'high');
    else if ((phq9Score || 0) >= 5) addFinding('psych', '轻度抑郁情绪', 'med');
    
    if ((gad7Score || 0) >= 10) addFinding('psych', '焦虑倾向(GAD-7)', 'high');
    
    if ((selfHarmIdea || 0) > 0) addFinding('psych', '存在自伤念头', 'high');

    // --- 3. Build & Sort Portraits ---
    const portraits: SystemRiskPortrait[] = Object.values(systems).map(sys => {
        // Cap Score at 0-100
        const score = Math.max(0, 100 - sys.deduction);
        
        let status: SystemRiskPortrait['status'] = 'Normal';
        if (score < 60) status = 'High';
        else if (score < 85) status = 'Medium';
        else if (score < 95) status = 'Low'; // A little deduction, barely noticeable
        
        // Define Focus Areas based on score
        const focusAreas = [];
        if (status === 'High') focusAreas.push('立即临床干预', '专科复查');
        else if (status === 'Medium') focusAreas.push('生活方式调整', '定期监测');
        else focusAreas.push('保持健康生活');

        return {
            systemName: sys.name,
            icon: sys.icon,
            status,
            score,
            keyFindings: sys.findings,
            focusAreas,
            lifestyleImpact: sys.lifestyle
        };
    });

    // Sort: High Risk (Low Score) First
    portraits.sort((a, b) => a.score - b.score);

    return portraits;
};

/**
 * 2. 预测模型评估引擎
 * 模拟 14 个常用医学模型的计算逻辑。
 */
export const evaluateRiskModels = (record: HealthRecord): PredictionModelResult[] => {
    const models: PredictionModelResult[] = [];
    const extras = record.riskModelExtras || {};
    const q = record.questionnaire;

    // Helper: Smart Get Value
    const getVal = (key: string): any => {
        // 1. Manual override from riskModelExtras
        if (extras[key] !== undefined && extras[key] !== '') return extras[key];

        // 2. Structured mappings
        switch(key) {
            case 'age': return record.profile.age;
            case 'gender': return record.profile.gender;
            case 'sbp': return record.checkup.basics.sbp;
            case 'bmi': return record.checkup.basics.bmi;
            case 'tc': return parseFloat(record.checkup.labBasic.lipids?.tc || '0') || undefined;
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
        if (!tc) missing.push({key: 'tc', label: '总胆固醇'});
        if (!waist) missing.push({key: 'waist', label: '腰围(cm)'});

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

        if (parentHip === undefined) missing.push({key: 'parentHip', label: '父母髋骨骨折史(是/否)'});
        if (steroids === undefined) missing.push({key: 'steroids', label: '长期使用激素(是/否)'});

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
        const phlegm = getVal('chronicPhlegm');
        const shortBreath = getVal('shortBreath');

        if (packYears === undefined && getVal('isSmoking') === undefined) missing.push({key: 'packYears', label: '吸烟包年数'});
        if (cough === undefined) missing.push({key: 'chronicCough', label: '经常咳嗽?'});

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
        if (phlegm) score += 2;
        if (shortBreath) score += 3;
        
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

        if (!menarche) missing.push({key: 'menarcheAge', label: '初潮年龄'});
        if (!firstBirthStr) missing.push({key: 'firstBirthAge', label: '首次生育年龄'});
        if (biopsy === undefined) missing.push({key: 'breastBiopsy', label: '乳腺活检史'});
        if (familyBc === undefined) missing.push({key: 'familyBc', label: '直系亲属乳腺癌史'});

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

        if (phq === undefined || gad === undefined) {
             return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing: [{key:'phq9', label:'PHQ-9评分'}], desc: '需完成心理量表' };
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
        if (getVal('colonCancer') === undefined) missing.push({key: 'colonCancer', label: '亲属肠癌史'});
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

    // --- 8. NLST (肺癌筛查 - New) ---
    const nlstCalc = () => {
        const missing = [];
        const age = getVal('age');
        const packYears = getVal('packYears');
        const isSmoking = getVal('isSmoking'); 
        const quitYearStr = q.substances.smoking.quitYear;
        
        if (!age) missing.push({key: 'age', label: '年龄'});
        if (packYears === undefined) missing.push({key: 'packYears', label: '吸烟包年数'});
        
        if (missing.length > 0) return { score: '-', riskLevel: 'UNKNOWN' as const, riskLabel: '未知' as const, missing, desc: '需吸烟量细节' };

        // NLST Criteria:
        // 1. Age 55-74
        // 2. Pack-years >= 30
        // 3. Current smoker OR Quit <= 15 years ago

        if (age < 50) return { score: 'NA', riskLevel: RiskLevel.GREEN, riskLabel: '低风险' as const, missing: [], desc: '年龄<50岁' };

        let criteria = 0;
        if (age >= 55 && age <= 74) criteria++;
        if (packYears && packYears >= 30) criteria++;
        
        let smokingCriteria = false;
        if (isSmoking) {
            smokingCriteria = true;
        } else if (quitYearStr) {
            // Parse year roughly
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

    // Execute
    // Re-use helper
    const run = (id: string, name: string, cat: string, fn: Function): PredictionModelResult | null => {
        const res = fn();
        if (res === null) return null; // Skip if model not applicable (e.g. Gail for men)
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
        run('tumor_gail', 'Gail 乳腺癌风险', '肿瘤风险', gailCalc),
        run('tumor_nlst', 'NLST 肺癌筛查', '肿瘤风险', nlstCalc),
        run('psych_scales', '心理健康 (PHQ/GAD)', '心理精神', mentalCalc),
        run('tumor_colon', '亚太结直肠癌评分', '肿瘤风险', colonCalc),
        
        // Placeholders
        { modelId: 'dig_nafld', modelName: 'NAFLD 肝纤维化', category: '消化系统', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '待接入生化指标', missingParams: [], lastCalculated: '' },
        { modelId: 'tumor_gastric', modelName: '新型胃癌筛查', category: '肿瘤风险', score: 'NA', riskLabel: '未知', riskLevel: 'UNKNOWN', description: '待接入Hp结果', missingParams: [], lastCalculated: '' }
    ];

    // Filter out nulls (not applicable models)
    return results.filter(m => m !== null) as PredictionModelResult[];
};
