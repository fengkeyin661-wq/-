
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onRefresh?: () => void; // Add refresh callback
}

export const HospitalHeatmap: React.FC<Props> = ({ archives, onRefresh }) => {
    const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentAnalytics | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    // Initial Aggregation & Analysis
    useEffect(() => {
        analyze();
    }, [archives]);

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
            .slice(0, 40) // Increased to capture more variety
            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

        try {
            // 3. AI Analysis
            const result = await generateHospitalBusinessAnalysis(topIssues);
            // Sort by count descending
            setAnalytics(result.sort((a, b) => b.patientCount - a.patientCount));
            setLastUpdated(new Date().toLocaleString());
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
        if(onRefresh) onRefresh(); // Trigger global data fetch
        analyze(); // Trigger local re-analysis
    }

    return (
        <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span>📊</span> 医院医疗服务热力图 (AI Analytics)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        基于全院 {archives.length} 份健康档案分析，指导临床业务开展
                        {lastUpdated && <span className="ml-2 bg-slate-200 px-2 py-0.5 rounded text-xs">上次更新: {lastUpdated}</span>}
                    </p>
                </div>
                <button onClick={handleManualRefresh} className="bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 font-bold text-slate-600 flex items-center gap-2 shadow-sm">
                    <span>🔄</span> 实时刷新分析
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-teal-600">
                    <div className="text-4xl animate-spin mb-4">⚙️</div>
                    <p className="font-bold text-lg">AI 正在深度分析异常数据并规划科室业务...</p>
                    <p className="text-sm text-slate-400 mt-2">正在关联：消化、心血管、呼吸、骨科、眼科等专科...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* Heatmap Grid */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                        {analytics.length === 0 ? (
                            <div className="text-center text-slate-400 mt-20">
                                暂无足够数据生成热力图，请先录入健康档案。
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
                                            <div className="text-3xl font-black mb-2">{dept.patientCount} <span className="text-xs font-normal opacity-80">人次需求</span></div>
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
                    <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col">
                        {selectedDept ? (
                            <div className="h-full flex flex-col">
                                <div className="p-6 border-b bg-blue-50">
                                    <h3 className="text-xl font-bold text-slate-800">{selectedDept.departmentName}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                                            潜在患者: {selectedDept.patientCount} 人
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                                            selectedDept.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            需求强度: {selectedDept.riskLevel === 'HIGH' ? '高' : '中'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <div className="mb-6">
                                        <h4 className="font-bold text-slate-600 mb-3 text-sm uppercase tracking-wider">主要关联病种</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedDept.keyConditions.map((cond, i) => (
                                                <span key={i} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
                                                    {cond}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-bold text-teal-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                            <span>💡</span> 建议开展诊疗业务
                                        </h4>
                                        <ul className="space-y-3">
                                            {selectedDept.suggestedServices.map((srv, i) => (
                                                <li key={i} className="flex items-start gap-3 bg-teal-50 p-3 rounded-lg border border-teal-100">
                                                    <span className="text-teal-500 font-bold text-lg mt-[-2px]">✓</span>
                                                    <span className="text-slate-800 font-medium text-sm">{srv}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="p-4 border-t bg-slate-50 text-center">
                                    <button className="bg-blue-600 text-white w-full py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md">
                                        导出该科室业务报告
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                <div className="text-6xl mb-4">👈</div>
                                <h3 className="text-lg font-bold text-slate-600">请选择左侧科室</h3>
                                <p className="text-sm mt-2">查看该科室的详细业务建议与患者画像</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
