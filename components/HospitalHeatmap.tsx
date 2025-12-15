
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onRefresh?: () => void;
    onSelectPatient?: (archive: HealthArchive) => void;
}

// --- 1. 临床业务挖掘规则引擎 (Based on user provided list) ---
// Key: 服务名称关键词 (部分匹配)
// Value: 潜在人群的搜索特征 (包含疾病名、指标名、症状、风险标签)
const SERVICE_MAPPING_RULES: Record<string, string[]> = {
    // [内分泌科]
    "甲状腺超声": ["甲状腺结节", "甲状腺肿", "甲状腺回声", "TI-RADS", "颈部包块"],
    "细针穿刺": ["甲状腺结节", "TI-RADS 4", "TI-RADS 3", "低回声", "钙化"],
    "糖化血红蛋白": ["糖尿病", "空腹血糖", "葡萄糖", "HbA1c", "糖耐量", "多饮", "多尿"],
    "胰岛素释放": ["肥胖", "BMI", "超重", "代谢综合征", "胰岛素抵抗", "黑棘皮", "糖尿病前期"],
    "血脂全套": ["高血脂", "甘油三酯", "总胆固醇", "低密度脂蛋白", "脂肪肝", "代谢综合征", "超重"],
    "尿酸": ["高尿酸", "痛风", "关节痛", "尿酸", "肾结石"],

    // [消化内科]
    "肝脏弹性": ["脂肪肝", "肝硬化", "肝纤维化", "乙肝", "丙肝", "转氨酶", "ALT", "AST", "肝回声增粗"],
    "胃肠镜": ["胃功能", "幽门螺杆菌", "Hp", "胃蛋白酶", "胃泌素", "肠化生", "息肉", "潜血", "CEA", "CA199", "胃痛", "反酸", "腹胀", "家族史"],
    "呼气试验": ["幽门螺杆菌", "Hp", "碳13", "碳14", "口臭", "胃炎", "消化性溃疡"],

    // [心血管内科]
    "动态血压": ["高血压", "收缩压", "舒张压", "头晕", "头痛", "降压药"],
    "心脏超声": ["高血压", "心脏杂音", "心力衰竭", "瓣膜", "室壁肥厚", "心扩大"],
    "颈动脉超声": ["动脉硬化", "斑块", "内中膜", "狭窄", "高血脂", "脑卒中史", "头晕"],
    "冠脉CTA": ["冠心病", "心绞痛", "胸闷", "胸痛", "ST段", "T波", "心肌缺血", "钙化积分"],
    "动态心电图": ["心律失常", "早搏", "房颤", "心悸", "心慌", "心动过速", "心动过缓", "停搏"],
    "运动负荷": ["不典型胸痛", "心肌缺血", "隐匿性冠心病"],

    // [泌尿外科]
    "PSA": ["前列腺", "PSA", "前列腺增生", "尿频", "尿急", "夜尿增多", "排尿困难"],
    "泌尿系超声": ["肾结石", "输尿管结石", "肾积水", "血尿", "腰痛", "肾囊肿"],
    "CT尿路": ["复杂结石", "血尿", "肿瘤占位"],

    // [眼科]
    "眼底照相": ["眼底", "视网膜", "黄斑", "糖尿病视网膜病变", "高血压眼底", "飞蚊症", "视物模糊"],
    "OCT": ["黄斑变性", "青光眼", "视网膜"],
    "眼压": ["青光眼", "眼压", "眼胀", "视野缺损", "虹视", "头痛"],
    "裂隙灯": ["白内障", "晶体混浊", "视力下降", "畏光"],

    // [骨科]
    "脊柱MRI": ["颈椎病", "腰椎间盘", "椎管狭窄", "坐骨神经痛", "手麻", "颈痛", "腰痛"],
    "骨密度": ["骨质疏松", "骨量减少", "骨折史", "绝经", "驼背", "身高变矮"],
    "关节超声": ["骨关节炎", "关节积液", "滑膜炎", "膝关节痛", "关节肿胀", "骨刺"],

    // [妇科]
    "妇科超声": ["子宫肌瘤", "卵巢囊肿", "附件", "盆腔积液", "月经不调", "痛经"],
    "HPV": ["宫颈", "TCT", "HPV", "接触性出血", "阴道炎"],
    "乳腺超声": ["乳腺结节", "乳腺增生", "BI-RADS", "乳房胀痛", "乳头溢液"],
    "钼靶": ["乳腺钙化", "BI-RADS 4", "高龄女性"],

    // [肾内科]
    "尿微量白蛋白": ["蛋白尿", "尿常规", "泡沫尿", "水肿", "糖尿病肾病", "高血压肾病", "肌酐", "尿素"],
    "肾动态": ["肾功能不全", "GFR", "肾小球滤过率"],

    // [呼吸内科]
    "低剂量胸部CT": ["肺结节", "磨玻璃", "实性结节", "阴影", "占位", "肺癌家族史", "吸烟", "包年"],
    "肺功能": ["慢阻肺", "COPD", "哮喘", "慢性咳嗽", "咳痰", "气短", "呼吸困难", "吸烟史"]
};

// Helper for exporting data
const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Updated Cache Key to force refresh with new structure
const CACHE_KEY = 'HEALTH_GUARD_HEATMAP_CACHE_V4';

export const HospitalHeatmap: React.FC<Props> = ({ archives, onRefresh, onSelectPatient }) => {
    const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentAnalytics | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [isCachedData, setIsCachedData] = useState(false);
    
    // State for Potential Patient List Modal
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [patientList, setPatientList] = useState<HealthArchive[]>([]);
    const [targetService, setTargetService] = useState('');

    // Initial Load: Check Cache First
    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.analytics && parsed.analytics.length > 0) {
                    setAnalytics(parsed.analytics);
                    setLastUpdated(parsed.lastUpdated);
                    setIsCachedData(true);
                    return; // Stop here, do not auto-analyze
                }
            } catch (e) {
                console.warn("Cache parse failed, falling back to live analysis");
            }
        }
        
        // Only auto-analyze if no cache and we have data
        if (archives.length > 0) {
            analyze();
        }
    }, [archives]); // Add archives dependency

    const analyze = async () => {
        if (archives.length === 0) return;
        setLoading(true);

        // Defer execution to next tick to allow UI to show loading spinner
        setTimeout(async () => {
            try {
                // 1. Local Aggregation: Count occurrences of keywords in risks and abnormalities
                const issueCounts: { [key: string]: number } = {};

                archives.forEach(arch => {
                    const issues = new Set<string>(); // Use Set to avoid double counting per patient
                    
                    // Helper to check text against keywords
                    const checkAndAdd = (text: string) => {
                        const t = text.toLowerCase();
                        // Metabolic / CV
                        if (t.includes('高血压') || t.includes('血压')) issues.add('高血压');
                        if (t.includes('糖尿病') || t.includes('血糖') || t.includes('糖化')) issues.add('糖尿病/高血糖');
                        if (t.includes('血脂') || t.includes('胆固醇') || t.includes('甘油三酯')) issues.add('高血脂');
                        if (t.includes('肥胖') || t.includes('超重') || t.includes('bmi')) issues.add('肥胖/代谢综合征');
                        if (t.includes('尿酸') || t.includes('痛风')) issues.add('高尿酸');
                        if (t.includes('心律') || t.includes('早搏') || t.includes('房颤') || t.includes('st段')) issues.add('心律失常/心肌缺血');
                        if (t.includes('动脉硬化') || t.includes('斑块') || t.includes('内中膜')) issues.add('动脉硬化/斑块');
                        
                        // Gastroenterology (消化内科)
                        if (t.includes('幽门') || t.includes('hp') || t.includes('碳13')) issues.add('幽门螺杆菌感染');
                        if (t.includes('胃泌素') || t.includes('胃蛋白酶')) issues.add('胃功能异常');
                        if (t.includes('脂肪肝') || t.includes('肝功') || t.includes('转氨酶')) issues.add('肝病/脂肪肝');
                        if (t.includes('胆囊') || t.includes('胆结石') || t.includes('息肉')) issues.add('胆囊疾病');
                        if (t.includes('肠') || t.includes('ca199') || t.includes('cea')) issues.add('胃肠肿瘤风险');

                        // Endocrine / Thyroid (内分泌/甲状腺)
                        if (t.includes('甲状腺') && (t.includes('结节') || t.includes('回声'))) issues.add('甲状腺结节');
                        if (t.includes('t3') || t.includes('t4') || t.includes('tsh')) issues.add('甲功异常');
                        if (t.includes('骨质疏松') || t.includes('骨量')) issues.add('骨质疏松');

                        // Respiratory (呼吸)
                        if (t.includes('肺') && (t.includes('结节') || t.includes('磨玻璃'))) issues.add('肺结节');
                        if (t.includes('肺纹理') || t.includes('慢支') || t.includes('肺气肿')) issues.add('慢性呼吸道疾病');

                        // Orthopedics (骨科/康复)
                        if (t.includes('颈椎') || t.includes('生理曲度')) issues.add('颈椎病');
                        if (t.includes('腰椎') || t.includes('椎间盘')) issues.add('腰椎病变');
                        if (t.includes('关节') || t.includes('退行性')) issues.add('骨关节炎');

                        // Ophthalmology (眼科)
                        if (t.includes('白内障') || t.includes('晶体混浊')) issues.add('白内障');
                        if (t.includes('眼底') || t.includes('视网膜') || t.includes('动脉硬化')) issues.add('眼底病变');
                        if (t.includes('青光眼') || t.includes('眼压')) issues.add('青光眼风险');

                        // Urology / Nephrology (泌尿/肾内)
                        if (t.includes('前列腺') || t.includes('psa')) issues.add('前列腺增生/异常');
                        if (t.includes('肾结石') || t.includes('积水')) issues.add('泌尿系结石');
                        if (t.includes('肌酐') || t.includes('尿素') || t.includes('蛋白尿')) issues.add('肾功能损伤');

                        // Gynecology (妇科)
                        if (t.includes('乳腺') && (t.includes('结节') || t.includes('增生') || t.includes('bi-rads'))) issues.add('乳腺结节/增生');
                        if (t.includes('子宫') || t.includes('肌瘤') || t.includes('hpv') || t.includes('tct')) issues.add('妇科常见病');
                    };

                    // Scan Risks
                    [...arch.assessment_data.risks.red, ...arch.assessment_data.risks.yellow].forEach(checkAndAdd);

                    // Scan Abnormalities (Structured)
                    if (arch.health_record.checkup?.abnormalities) {
                        arch.health_record.checkup.abnormalities.forEach(ab => {
                            checkAndAdd(ab.item + " " + ab.result + " " + ab.clinicalSig);
                        });
                    }
                    
                    issues.forEach(issue => {
                        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
                    });
                });

                // 2. Filter top issues to prevent token overflow
                const topIssues = Object.entries(issueCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 40)
                    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

                // 3. AI Analysis
                const result = await generateHospitalBusinessAnalysis(topIssues);
                
                // Sort by count descending
                const sortedResults = result.sort((a, b) => b.patientCount - a.patientCount);
                const timestamp = new Date().toLocaleString();
                
                setAnalytics(sortedResults);
                setLastUpdated(timestamp);
                setIsCachedData(false); // This is fresh data

                // Save to Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    analytics: sortedResults,
                    lastUpdated: timestamp
                }));

            } catch (e) {
                console.error(e);
                alert("生成热力图失败，请稍后重试");
            } finally {
                setLoading(false);
            }
        }, 50);
    };

    const getHeatColor = (count: number, max: number) => {
        const ratio = count / max;
        if (ratio > 0.8) return 'bg-red-600 text-white';
        if (ratio > 0.6) return 'bg-red-400 text-white';
        if (ratio > 0.4) return 'bg-orange-400 text-white';
        if (ratio > 0.2) return 'bg-yellow-400 text-slate-800';
        return 'bg-green-100 text-green-800';
    };

    const maxCount = Math.max(...analytics.map(a => a.patientCount), 1);

    const handleManualRefresh = () => {
        setIsCachedData(false);
        // Clear cache so it forces a recalculation even if archives didn't change
        localStorage.removeItem(CACHE_KEY); 
        
        if(onRefresh) onRefresh();
        
        // Wait slightly for any parent updates or just to show loading
        setTimeout(() => analyze(), 100);
    }

    // --- Reverse Search Logic (Enhanced V2) ---
    const handleServiceDoubleClick = (serviceName: string, serviceDesc: string) => {
        let searchTerms: string[] = [];

        // 1. 优先匹配规则库 (Rule-based Mapping)
        // 遍历所有规则，如果服务名称包含规则的Key，则加入对应的Values
        Object.entries(SERVICE_MAPPING_RULES).forEach(([key, terms]) => {
            if (serviceName.includes(key) || serviceDesc.includes(key)) {
                searchTerms.push(...terms);
            }
        });

        // 2. 补充策略: 使用科室核心病种 (Department Context)
        if (selectedDept && selectedDept.keyConditions) {
            // 简单筛选：如果病种出现在服务描述中，也作为关键词
            const matchedConditions = selectedDept.keyConditions.filter(cond => 
                serviceDesc.includes(cond) || serviceName.includes(cond)
            );
            searchTerms.push(...matchedConditions);
        }

        // 3. 兜底策略: 如果规则库未命中，提取服务名本身的关键词
        if (searchTerms.length === 0) {
            const cleanName = serviceName.replace(/建议|开展|强化|检查|检测|筛查|评估|管理|干预|专科|门诊|项目|服务|全套|综合|分析|及|试验|术/g, '').trim();
            if (cleanName.length > 1) searchTerms.push(cleanName);
        }

        // 去重
        searchTerms = Array.from(new Set(searchTerms));
        console.log(`[${serviceName}] 匹配关键词:`, searchTerms);

        if (searchTerms.length === 0) {
            alert("未能识别该服务的关键特征，无法筛选患者。");
            return;
        }

        // 4. 执行全档案检索 (Full Corpus Search)
        const matched = archives.filter(arch => {
            const record = arch.health_record;
            const assess = arch.assessment_data;
            
            // 构建患者全维健康语料库
            const corpusParts = [
                // A. 风险标签
                ...(assess.risks.red || []),
                ...(assess.risks.yellow || []),
                assess.summary || '',
                // B. 体检异常项 (最重要)
                ...(record.checkup.abnormalities?.map(a => `${a.item} ${a.result} ${a.clinicalSig}`) || []),
                // C. 既往史/家族史
                ...(record.questionnaire.history.diseases || []),
                record.questionnaire.history.details.otherHistory || '',
                // D. 风险画像发现
                ...(arch.risk_analysis?.portraits?.flatMap(p => p.keyFindings) || []),
                // E. 核心指标直接数值 (针对BMI, 血压等)
                (record.checkup.basics.bmi || 0) > 24 ? '超重 肥胖' : '',
                (record.checkup.basics.sbp || 0) >= 140 || (record.checkup.basics.dbp || 0) >= 90 ? '高血压' : '',
                // F. 烟酒
                record.questionnaire.substances.smoking.status === '目前吸烟' ? '吸烟' : '',
            ];
            
            const corpus = corpusParts.join(' ').toLowerCase();

            // 匹配逻辑：只要包含任意一个关键词即可
            return searchTerms.some(term => term && corpus.includes(term.toLowerCase()));
        });

        setTargetService(serviceName);
        setPatientList(matched);
        setShowPatientModal(true);
    };

    // --- New Global Export Function ---
    const handleExportGlobalReport = () => {
        if (analytics.length === 0) {
            alert("暂无分析数据，请等待分析完成。");
            return;
        }

        const totalPotentialPatients = analytics.reduce((acc, curr) => acc + curr.patientCount, 0);

        let reportContent = `
【全院医疗业务发展潜力分析报告】
================================================
生成日期: ${new Date().toLocaleString()}
数据来源: 郑州大学医院健康管理系统 (AI分析)
覆盖档案: ${archives.length} 份
识别业务机会: ${analytics.length} 个科室/方向
累计潜在需求: ${totalPotentialPatients} 人次 (非去重)

================================================
【重点科室业务规划详情】
`;

        analytics.forEach((dept, index) => {
            reportContent += `\n${index + 1}. [${dept.departmentName}] \n`;
            reportContent += `   - 需求强度: ${dept.riskLevel === 'HIGH' ? '⭐⭐⭐ (高)' : dept.riskLevel === 'MEDIUM' ? '⭐⭐ (中)' : '⭐ (低)'}\n`;
            reportContent += `   - 潜在患者池: ${dept.patientCount} 人\n`;
            reportContent += `   - 核心病种: ${dept.keyConditions.join(', ')}\n`;
            reportContent += `   - 💡 建议开展/强化业务:\n`;
            dept.suggestedServices.forEach(s => {
                // Compatible with both old string array and new object array
                if (typeof s === 'string') {
                    reportContent += `     • ${s}\n`;
                } else {
                    reportContent += `     • ${s.name} (预计覆盖: ${s.count}人)\n       说明: ${s.description}\n`;
                }
            });
            reportContent += `------------------------------------------------`;
        });

        reportContent += `\n\n* 本报告基于健康档案大数据自动生成，旨在辅助医院进行医疗资源配置与新业务拓展规划。`;

        downloadFile(reportContent, `全院医疗业务发展潜力分析报告_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain;charset=utf-8');
    };

    return (
        <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn relative">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span>📊</span> 医院医疗服务热力图 (AI Analytics)
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                         <p className="text-sm text-slate-500">
                            基于全院 {archives.length} 份健康档案，AI 自动识别业务增长点
                         </p>
                         {lastUpdated && (
                             <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isCachedData ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                 {isCachedData ? '📦 已加载缓存' : '✨ 实时分析'} | 更新于: {lastUpdated}
                             </span>
                         )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExportGlobalReport}
                        className="bg-indigo-600 text-white border border-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                        <span>📥</span> 导出全院业务规划报告
                    </button>
                    <button 
                        onClick={handleManualRefresh}
                        className="bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 font-bold text-slate-600 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <span>🔄</span> 重新分析
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-teal-600">
                    <div className="text-4xl animate-spin mb-4">⚙️</div>
                    <p className="font-bold text-lg">AI 正在深度挖掘全院数据价值...</p>
                    <p className="text-sm text-slate-400 mt-2">正在计算各科室潜在病源，规划特色诊疗项目...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Heatmap Grid */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                        {analytics.length === 0 ? (
                            <div className="text-center text-slate-400 mt-20">
                                暂无分析数据，请点击右上角刷新。
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {analytics.map((dept, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setSelectedDept(dept)}
                                        className={`p-4 rounded-xl shadow-sm transition-all transform hover:scale-105 hover:shadow-lg text-left relative overflow-hidden group border border-transparent ${
                                            selectedDept?.departmentName === dept.departmentName ? 'ring-4 ring-blue-400' : ''
                                        } ${getHeatColor(dept.patientCount, maxCount)}`}
                                    >
                                        <div className="relative z-10">
                                            <div className="text-lg font-bold mb-1 truncate">{dept.departmentName}</div>
                                            <div className="text-3xl font-black mb-2">{dept.patientCount} <span className="text-xs font-normal opacity-80">潜在患者</span></div>
                                            <div className="flex flex-wrap gap-1">
                                                {dept.keyConditions.slice(0, 2).map((c, i) => (
                                                    <span key={i} className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                        {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-4 -right-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity">
                                            🏥
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col transition-all duration-300 shadow-xl z-10">
                        {selectedDept ? (
                            <div className="h-full flex flex-col">
                                <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-white">
                                    <h3 className="text-xl font-bold text-slate-800">{selectedDept.departmentName}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                                            selectedDept.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            需求强度: {selectedDept.riskLevel === 'HIGH' ? '高' : '中'}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            占全院比重: {Math.round((selectedDept.patientCount / Math.max(archives.length, 1)) * 100)}%
                                        </span>
                                    </div>
                                    <div className="mt-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">潜在患者规模</div>
                                        <div className="text-2xl font-black text-blue-600 flex items-baseline gap-1">
                                            {selectedDept.patientCount} 
                                            <span className="text-sm font-normal text-slate-500">人</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <div className="mb-6">
                                        <h4 className="font-bold text-slate-600 mb-3 text-xs uppercase tracking-wider">主要关联异常/病种</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedDept.keyConditions.map((cond, i) => (
                                                <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium border border-slate-200">
                                                    {cond}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-bold text-teal-700 mb-3 text-xs uppercase tracking-wider flex items-center justify-between">
                                            <span className="flex items-center gap-2"><span>💡</span> 建议开展/强化业务</span>
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">双击卡片挖掘目标人群</span>
                                        </h4>
                                        <ul className="space-y-3">
                                            {selectedDept.suggestedServices.map((srv, i) => {
                                                // Handle new Object structure vs old String structure safely
                                                const sName = typeof srv === 'string' ? srv : srv.name;
                                                const sCount = typeof srv === 'string' ? Math.round(selectedDept.patientCount * 0.8) : srv.count;
                                                const sDesc = typeof srv === 'string' ? '' : srv.description;

                                                return (
                                                    <li 
                                                        key={i} 
                                                        className="flex flex-col gap-1 bg-teal-50 p-3 rounded-lg border border-teal-100 cursor-pointer hover:bg-teal-100 hover:shadow-md transition-all select-none group"
                                                        title="双击自动挖掘潜在患者名单"
                                                        onDoubleClick={() => handleServiceDoubleClick(sName, sDesc)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-teal-500 font-bold text-sm mt-[2px] group-hover:scale-125 transition-transform">●</span>
                                                            <div className="flex-1">
                                                                <span className="text-slate-800 font-bold text-sm block">{sName}</span>
                                                                {sDesc && <span className="text-xs text-slate-500 block mt-1">{sDesc}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="pl-6 text-xs text-teal-600/80 mt-1 flex items-center justify-between">
                                                            <span>预计覆盖潜在人群: <span className="font-bold">{sCount}</span> 人</span>
                                                            {/* Simple visual bar */}
                                                            <div className="w-16 h-1.5 bg-teal-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-teal-500" style={{ width: `${Math.min((sCount / selectedDept.patientCount) * 100, 100)}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                                <div className="text-6xl mb-4 opacity-50">👈</div>
                                <h3 className="text-lg font-bold text-slate-600">选择科室查看规划</h3>
                                <p className="text-xs mt-2 max-w-[200px]">点击左侧热力图块，查看该科室的详细业务建议与潜在患者规模分析</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Potential Patient List Modal */}
            {showPatientModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl h-[80%] rounded-xl shadow-2xl flex flex-col animate-scaleIn">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    🔍 潜在目标人群分析
                                </h3>
                                <div className="text-xs text-teal-700 font-medium mt-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 inline-block">
                                    目标业务: {targetService}
                                </div>
                            </div>
                            <button onClick={() => setShowPatientModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">×</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4">
                            {patientList.length > 0 ? (
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 border-b">姓名</th>
                                            <th className="px-4 py-2 border-b">性别/年龄</th>
                                            <th className="px-4 py-2 border-b">部门</th>
                                            <th className="px-4 py-2 border-b">风险等级</th>
                                            <th className="px-4 py-2 border-b text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {patientList.map(p => (
                                            <tr key={p.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-700">{p.name}</td>
                                                <td className="px-4 py-3 text-slate-600">{p.gender} / {p.age}</td>
                                                <td className="px-4 py-3 text-slate-600">{p.department}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                                        p.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                                        p.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-green-50 text-green-600 border-green-200'
                                                    }`}>
                                                        {p.risk_level === 'RED' ? '高危' : p.risk_level === 'YELLOW' ? '中危' : '低危'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button 
                                                        onClick={() => {
                                                            if (onSelectPatient) {
                                                                onSelectPatient(p);
                                                                setShowPatientModal(false);
                                                            }
                                                        }}
                                                        className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold border border-indigo-200 transition-colors"
                                                    >
                                                        查看方案 👉
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <div className="text-4xl mb-2">🤷‍♂️</div>
                                    <p>未找到匹配该业务关键词的潜在患者</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 text-center rounded-b-xl">
                            共筛选出 {patientList.length} 位潜在目标人员
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
