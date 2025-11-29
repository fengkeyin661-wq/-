
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onClose: () => void;
}

export const HospitalHeatmap: React.FC<Props> = ({ archives, onClose }) => {
    const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentAnalytics | null>(null);

    // Initial Aggregation & Analysis
    useEffect(() => {
        const analyze = async () => {
            if (archives.length === 0) return;
            setLoading(true);

            // 1. Local Aggregation: Count occurrences of keywords in risks and abnormalities
            const issueCounts: { [key: string]: number } = {};

            archives.forEach(arch => {
                const issues = new Set<string>(); // Use Set to avoid double counting per patient
                
                // From Risks
                [...arch.assessment_data.risks.red, ...arch.assessment_data.risks.yellow].forEach(r => {
                    // Simple keyword extraction (naive but effective for aggregation)
                    if (r.includes('高血压') || r.includes('血压')) issues.add('高血压');
                    if (r.includes('糖尿病') || r.includes('血糖')) issues.add('糖尿病/高血糖');
                    if (r.includes('血脂') || r.includes('胆固醇')) issues.add('高血脂');
                    if (r.includes('结节') && r.includes('甲状腺')) issues.add('甲状腺结节');
                    if (r.includes('结节') && r.includes('肺')) issues.add('肺结节');
                    if (r.includes('乳腺')) issues.add('乳腺异常');
                    if (r.includes('肥胖') || r.includes('超重') || r.includes('BMI')) issues.add('肥胖/超重');
                    if (r.includes('尿酸') || r.includes('痛风')) issues.add('高尿酸');
                    if (r.includes('心律') || r.includes('早搏') || r.includes('心电图')) issues.add('心律失常');
                    if (r.includes('脂肪肝')) issues.add('脂肪肝');
                    if (r.includes('颈动脉') || r.includes('斑块')) issues.add('颈动脉斑块');
                    if (r.includes('骨质疏松') || r.includes('骨量')) issues.add('骨质疏松');
                    if (r.includes('幽门')) issues.add('幽门螺杆菌');
                });

                // From Abnormalities list (Structured)
                if (arch.health_record.checkup?.abnormalities) {
                    arch.health_record.checkup.abnormalities.forEach(ab => {
                        issues.add(ab.item); // Add specific items like "ALT", "肌酐"
                    });
                }

                issues.forEach(issue => {
                    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
                });
            });

            // 2. Filter top issues to prevent token overflow
            const topIssues = Object.entries(issueCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 30) // Take top 30 distinct issues
                .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

            try {
                // 3. AI Analysis
                const result = await generateHospitalBusinessAnalysis(topIssues);
                // Sort by count descending
                setAnalytics(result.sort((a, b) => b.patientCount - a.patientCount));
            } catch (e) {
                alert("生成热力图失败，请稍后重试");
            } finally {
                setLoading(false);
            }
        };

        analyze();
    }, [archives]);

    const getHeatColor = (count: number, max: number) => {
        const ratio = count / max;
        if (ratio > 0.8) return 'bg-red-600 text-white';
        if (ratio > 0.6) return 'bg-red-400 text-white';
        if (ratio > 0.4) return 'bg-orange-400 text-white';
        if (ratio > 0.2) return 'bg-yellow-400 text-slate-800';
        return 'bg-green-100 text-green-800';
    };

    const maxCount = Math.max(...analytics.map(a => a.patientCount), 1);

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[80] flex items-center justify-center backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <span>📊</span> 医院医疗服务热力图 (AI Analytics)
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">基于全院 {archives.length} 份健康档案分析，指导临床业务开展</p>
                    </div>
                    <button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 font-bold text-slate-600">关闭</button>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-teal-600">
                        <div className="text-4xl animate-spin mb-4">⚙️</div>
                        <p className="font-bold text-lg">AI 正在聚合全院数据并规划科室业务...</p>
                        <p className="text-sm text-slate-400 mt-2">分析过程可能需要几秒钟</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        {/* Heatmap Grid */}
                        <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
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
        </div>
    );
};
