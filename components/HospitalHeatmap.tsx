
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onRefresh?: () => void;
    onSelectPatient?: (archive: HealthArchive) => void;
}

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
const CACHE_KEY = 'HEALTH_GUARD_HEATMAP_CACHE_V3';

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
    }, []);

    const analyze = async () => {
        if (archives.length === 0) return;
        setLoading(true);

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

        try {
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
        if(onRefresh) onRefresh();
        analyze();
    }

    // --- Reverse Search Logic (Updated) ---
    const handleServiceDoubleClick = (serviceName: string, serviceDesc: string) => {
        // 1. Determine Search Terms
        let searchTerms: string[] = [];

        // Strategy A: Match against Department Key Conditions (High Accuracy)
        // Check which key conditions (e.g., "High Blood Pressure") appear in the Service Description/Name
        if (selectedDept && selectedDept.keyConditions) {
            const matchedConditions = selectedDept.keyConditions.filter(cond => {
                const c = cond.toLowerCase();
                return serviceName.toLowerCase().includes(c) || serviceDesc.toLowerCase().includes(c);
            });
            searchTerms = [...matchedConditions];
        }

        // Strategy B: Fallback - Extract from Name & Description
        if (searchTerms.length === 0) {
            // Remove generic verbs/nouns to find the core subject
            const cleanName = serviceName.replace(/建议|开展|强化|检查|检测|筛查|评估|管理|干预|专科|门诊|项目|服务|全套|综合|分析/g, '').trim();
            if (cleanName.length > 1) searchTerms.push(cleanName);

            // Clean description to find core conditions
            const descKeywords = serviceDesc
                .split(/[,，;；:：.。、]/) // Split by punctuation
                .map(s => s.replace(/针对|进行|人群|患者|筛查|评估|治疗|管理|以及|等|包含/g, '').trim())
                .filter(s => s.length > 1);
            
            searchTerms = [...searchTerms, ...descKeywords];
        }

        // De-duplicate terms
        searchTerms = Array.from(new Set(searchTerms));

        // Safety fallback: search for the whole department name core if absolutely nothing else matches
        if (searchTerms.length === 0 && selectedDept) {
            searchTerms.push(selectedDept.departmentName.replace('科', ''));
        }

        console.log("Reverse Search Terms:", searchTerms);

        const matched = archives.filter(arch => {
            const record = arch.health_record;
            const assess = arch.assessment_data;
            
            // Build comprehensive searchable corpus for this patient
            const corpusParts = [
                // 1. Risks (Red/Yellow)
                ...(assess.risks.red || []),
                ...(assess.risks.yellow || []),
                assess.summary || '',
                // 2. Abnormalities (Detailed Items)
                ...(record.checkup.abnormalities?.map(a => `${a.item} ${a.result} ${a.clinicalSig}`) || []),
                // 3. History
                ...(record.questionnaire.history.diseases || []),
                // 4. Key Findings from Risk Portraits
                ...(arch.risk_analysis?.portraits?.flatMap(p => p.keyFindings) || []),
                // 5. Risk Models (High Risk Only)
                ...(arch.risk_analysis?.models?.filter(m => m.riskLevel === 'RED' || m.riskLevel === 'YELLOW').map(m => m.modelName) || [])
            ];
            
            const corpus = corpusParts.join(' ').toLowerCase();

            // Match Logic: Check if ANY search term exists in patient corpus
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
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">双击卡片查看名单</span>
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
                                                        className="flex flex-col gap-1 bg-teal-50 p-3 rounded-lg border border-teal-100 cursor-pointer hover:bg-teal-100 hover:shadow-md transition-all select-none"
                                                        title="双击查看潜在患者名单"
                                                        onDoubleClick={() => handleServiceDoubleClick(sName, sDesc)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-teal-500 font-bold text-sm mt-[2px]">●</span>
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
                                    业务方向: {targetService}
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
