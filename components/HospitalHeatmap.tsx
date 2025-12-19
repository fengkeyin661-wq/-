
import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onRefresh?: () => void;
    onSelectPatient?: (archive: HealthArchive) => void;
}

const CACHE_KEY = 'HEALTH_GUARD_HEATMAP_CACHE_V7_FULL';

export const HospitalHeatmap: React.FC<Props> = ({ archives, onRefresh, onSelectPatient }) => {
    const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentAnalytics | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.analytics && parsed.analytics.length > 0) {
                    setAnalytics(parsed.analytics);
                    setLastUpdated(parsed.lastUpdated);
                    return; 
                }
            } catch (e) {
                console.warn("Cache parse failed");
            }
        }
        if (archives.length > 0) analyze();
    }, [archives]);

    const analyze = async () => {
        if (archives.length === 0) return;
        setLoading(true);
        try {
            const issueCounts: { [key: string]: number } = {};
            archives.forEach(arch => {
                const findings = new Set<string>(); 
                if (arch.assessment_data?.risks) {
                    [...arch.assessment_data.risks.red, ...arch.assessment_data.risks.yellow].forEach(r => {
                        const clean = r.replace(/[.。;；]/g, '').trim();
                        if (clean) findings.add(clean);
                    });
                }
                findings.forEach(f => { issueCounts[f] = (issueCounts[f] || 0) + 1; });
            });

            // Fix TS7006 by adding explicit tuple types to entries
            const topIssues = Object.entries(issueCounts)
                .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                .slice(0, 50)
                .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {} as Record<string, number>);

            const result = await generateHospitalBusinessAnalysis(topIssues);
            
            // Fix TS7006 by adding explicit DepartmentAnalytics types
            const sortedResults = result.sort((a: DepartmentAnalytics, b: DepartmentAnalytics) => b.patientCount - a.patientCount);
            
            const now = new Date().toLocaleString();
            setAnalytics(sortedResults);
            setLastUpdated(now);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ analytics: sortedResults, lastUpdated: now }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">🏥 医疗服务热力图</h2>
                    {lastUpdated && <p className="text-xs text-slate-400 mt-1">最后更新: {lastUpdated}</p>}
                </div>
                <button onClick={() => { localStorage.removeItem(CACHE_KEY); onRefresh?.(); analyze(); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-teal-700 transition-colors">刷新分析</button>
            </div>
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                    {loading ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-500 font-medium">正在利用 AI 分析科室业务潜力...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {analytics.map((dept, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setSelectedDept(dept)} 
                                    className={`p-4 rounded-xl text-left bg-white border-2 transition-all hover:shadow-md ${selectedDept?.departmentName === dept.departmentName ? 'border-teal-500 ring-2 ring-teal-100' : 'border-transparent shadow-sm'}`}
                                >
                                    <div className="text-lg font-bold text-slate-700">{dept.departmentName}</div>
                                    <div className="text-2xl font-black text-teal-600 mt-1">{dept.patientCount} <span className="text-xs font-normal text-slate-400">人次</span></div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {selectedDept && (
                    <div className="w-full lg:w-80 bg-white border-l p-6 overflow-y-auto shadow-xl animate-slideInRight">
                        <h3 className="text-xl font-bold mb-6 text-slate-800 border-b pb-4">{selectedDept.departmentName}</h3>
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">建议开展项目</h4>
                                <ul className="space-y-3">
                                    {selectedDept.suggestedServices.map((s, i) => (
                                        <li key={i} className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                                            <div className="text-sm font-bold text-teal-800">{typeof s === 'string' ? s : s.name}</div>
                                            {typeof s !== 'string' && <div className="text-[10px] text-teal-600 mt-1">{s.description}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">核心异常统计</h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedDept.keyConditions.map((c, i) => (
                                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">{c}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedDept(null)} className="mt-8 w-full py-2 text-sm text-slate-400 font-bold hover:text-slate-600">关闭详情</button>
                    </div>
                )}
            </div>
        </div>
    );
};
