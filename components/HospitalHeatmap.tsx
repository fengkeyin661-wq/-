
import React, { useState, useEffect, useMemo } from 'react';
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
    const [isCachedData, setIsCachedData] = useState(false);

    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.analytics && parsed.analytics.length > 0) {
                    setAnalytics(parsed.analytics);
                    setLastUpdated(parsed.lastUpdated);
                    setIsCachedData(true);
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

            const topIssues = Object.entries(issueCounts)
                .sort(([,a]: [string, number], [,b]: [string, number]) => b - a)
                .slice(0, 50)
                .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

            const result = await generateHospitalBusinessAnalysis(topIssues);
            const sortedResults = result.sort((a: DepartmentAnalytics, b: DepartmentAnalytics) => b.patientCount - a.patientCount);
            
            setAnalytics(sortedResults);
            setLastUpdated(new Date().toLocaleString());
            setIsCachedData(false); 
            localStorage.setItem(CACHE_KEY, JSON.stringify({ analytics: sortedResults, lastUpdated: new Date().toLocaleString() }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const maxCount = Math.max(...analytics.map(a => a.patientCount), 1);

    return (
        <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-800">🏥 医疗服务热力图</h2>
                <button onClick={() => { localStorage.removeItem(CACHE_KEY); onRefresh?.(); analyze(); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold">刷新分析</button>
            </div>
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                    {loading ? <div className="text-center py-20">正在分析...</div> : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {analytics.map((dept, idx) => (
                                <button key={idx} onClick={() => setSelectedDept(dept)} className={`p-4 rounded-xl text-left bg-white border-2 ${selectedDept?.departmentName === dept.departmentName ? 'border-teal-500' : 'border-transparent shadow-sm'}`}>
                                    <div className="text-lg font-bold">{dept.departmentName}</div>
                                    <div className="text-2xl font-black text-teal-600">{dept.patientCount} <span className="text-xs font-normal text-slate-400">人次</span></div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {selectedDept && (
                    <div className="w-full lg:w-80 bg-white border-l p-6 overflow-y-auto shadow-xl">
                        <h3 className="text-xl font-bold mb-4">{selectedDept.departmentName}</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">建议开展项目</h4>
                                <ul className="space-y-2">
                                    {selectedDept.suggestedServices.map((s, i) => (
                                        <li key={i} className="p-2 bg-teal-50 rounded border border-teal-100 text-sm font-medium">{typeof s === 'string' ? s : s.name}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
