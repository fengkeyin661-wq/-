import React, { useState, useEffect } from 'react';
import { HealthArchive } from '../services/dataService';
import { generateHospitalBusinessAnalysis } from '../services/geminiService';
import { DepartmentAnalytics } from '../types';

interface Props {
    archives: HealthArchive[];
    onRefresh?: () => void;
    onSelectPatient?: (archive: HealthArchive) => void;
}

// --- 1. 临床业务挖掘规则引擎 (全科室覆盖) ---
const SERVICE_MAPPING_RULES: Record<string, string[]> = {
    "内分泌": ["糖尿病", "血糖", "糖化", "胰岛素", "甲状腺", "结节", "肥胖", "代谢综合征", "尿酸", "痛风"],
    "心血管": ["高血压", "血压", "心律", "早搏", "房颤", "胸闷", "ST段", "T波", "动脉硬化", "斑块"],
    "消化": ["幽门", "Hp", "胃", "肠", "息肉", "CEA", "腹胀", "脂肪肝", "转氨酶", "胆囊", "肝"],
    "呼吸": ["肺", "结节", "磨玻璃", "咳嗽", "气短", "慢阻肺", "吸烟", "支气管"],
    "泌尿": ["前列腺", "PSA", "尿频", "尿急", "夜尿", "肾结石", "输尿管", "隐血"],
    "结石": ["肾结石", "输尿管结石", "积水", "血尿", "胆结石"],
    "妇科": ["子宫", "肌瘤", "附件", "卵巢", "囊肿", "月经", "痛经", "白带", "宫颈"],
    "HPV": ["HPV", "TCT", "宫颈", "接触性出血"],
    "乳腺": ["乳腺", "结节", "增生", "BI-RADS", "钙化", "溢液"],
    "盆底": ["漏尿", "产后", "松弛", "子宫脱垂"],
    "中医": ["气虚", "湿热", "阴虚", "阳虚", "舌苔", "脉象", "亚健康", "调理"],
    "体质": ["乏力", "畏寒", "出汗", "便秘", "失眠", "易感冒"],
    "康复": ["颈椎病", "腰椎间盘", "脊柱", "侧弯", "中风后遗症", "偏瘫", "功能障碍", "疼痛", "麻木"],
    "理疗": ["疼痛", "手麻", "腿麻", "关节炎", "骨质增生", "活动受限"],
    "减重": ["BMI", "肥胖", "超重", "体重指数", "腹型肥胖", "腰围"],
    "体重管理": ["脂肪肝", "高血脂", "甘油三酯", "胰岛素抵抗", "黑棘皮", "多囊"],
    "骨科": ["骨质疏松", "骨量减少", "骨折", "关节", "半月板", "韧带", "膝", "腰"],
    "神经": ["头晕", "头痛", "眩晕", "失眠", "记忆力", "脑供血不足", "脑梗塞", "睡眠"],
    "睡眠": ["打鼾", "呼吸暂停", "早醒", "多梦", "入睡困难"]
};

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

const CACHE_KEY = 'HEALTH_GUARD_HEATMAP_CACHE_V7_FULL';

export const HospitalHeatmap: React.FC<Props> = ({ archives, onRefresh, onSelectPatient }) => {
    const [analytics, setAnalytics] = useState<DepartmentAnalytics[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState<DepartmentAnalytics | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [isCachedData, setIsCachedData] = useState(false);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [patientList, setPatientList] = useState<HealthArchive[]>([]);
    const [targetService, setTargetService] = useState('');

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
                        if (clean && clean.length < 20) findings.add(clean);
                    });
                }
                if (arch.health_record?.checkup?.abnormalities) {
                    arch.health_record.checkup.abnormalities.forEach(ab => {
                        if (ab.item) findings.add(ab.item.trim());
                    });
                }
                const bmi = arch.health_record.checkup.basics.bmi;
                if (bmi && bmi >= 24 && bmi < 28) findings.add("超重(BMI>=24)");
                if (bmi && bmi >= 28) findings.add("肥胖(BMI>=28)");
                findings.forEach(f => {
                    issueCounts[f] = (issueCounts[f] || 0) + 1;
                });
            });

            const topIssues = Object.entries(issueCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 80)
                .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

            const result = await generateHospitalBusinessAnalysis(topIssues);
            // FIX: Explicitly type a and b to prevent TS7006
            const sortedResults = result.sort((a: DepartmentAnalytics, b: DepartmentAnalytics) => b.patientCount - a.patientCount);
            const timestamp = new Date().toLocaleString();
            setAnalytics(sortedResults);
            setLastUpdated(timestamp);
            setIsCachedData(false); 
            localStorage.setItem(CACHE_KEY, JSON.stringify({ analytics: sortedResults, lastUpdated: timestamp }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getHeatColor = (count: number, max: number) => {
        const ratio = count / Math.max(max, 1);
        if (ratio > 0.8) return 'bg-red-600 text-white';
        if (ratio > 0.6) return 'bg-red-400 text-white';
        if (ratio > 0.4) return 'bg-orange-400 text-white';
        if (ratio > 0.2) return 'bg-yellow-400 text-slate-800';
        return 'bg-green-100 text-green-800';
    };

    const maxCount = Math.max(...analytics.map(a => a.patientCount), 1);

    const handleManualRefresh = () => {
        setIsCachedData(false);
        localStorage.removeItem(CACHE_KEY); 
        if(onRefresh) onRefresh();
        analyze();
    }

    const handleServiceDoubleClick = (serviceName: string, serviceDesc: string) => {
        let searchTerms: string[] = [];
        Object.entries(SERVICE_MAPPING_RULES).forEach(([key, terms]) => {
            if (serviceName.includes(key) || serviceDesc.includes(key)) {
                searchTerms.push(...terms);
            }
        });
        if (selectedDept && searchTerms.length === 0) {
            searchTerms.push(...selectedDept.keyConditions);
        }
        if (searchTerms.length === 0) {
            const cleanName = serviceName.replace(/建议|开展|强化|检查|检测|筛查|评估|管理|干预|专科|门诊|项目|服务|全套|综合|分析|及|试验|术/g, '').trim();
            if (cleanName.length > 1) searchTerms.push(cleanName);
        }
        searchTerms = Array.from(new Set(searchTerms));
        const matched = archives.filter(arch => {
            const bmi = arch.health_record.checkup.basics.bmi || 0;
            const corpus = [
                ...(arch.assessment_data.risks.red || []),
                ...(arch.assessment_data.risks.yellow || []),
                arch.assessment_data.summary || '',
                ...(arch.health_record.checkup.abnormalities?.map(a => `${a.item} ${a.result}`) || []),
                ...(arch.health_record.questionnaire.history.diseases || []),
                bmi >= 24 ? '超重 BMI' : '',
                bmi >= 28 ? '肥胖 BMI' : '',
                arch.age && arch.age > 60 ? '老年' : '',
                arch.gender === '女' && (arch.age || 0) > 45 ? '更年期' : ''
            ].join(' ').toLowerCase();
            return searchTerms.some(term => term && corpus.includes(term.toLowerCase()));
        });
        setTargetService(serviceName);
        setPatientList(matched);
        setShowPatientModal(true);
    };

    const handleExportGlobalReport = () => {
        if (analytics.length === 0) return;
        let reportContent = `【全院医疗业务分析报告】\n生成日期: ${new Date().toLocaleString()}\n\n`;
        analytics.forEach((dept, index) => {
            reportContent += `\n${index + 1}. [${dept.departmentName}] (潜力患者: ${dept.patientCount}人)\n   核心问题: ${dept.keyConditions.join(', ')}\n`;
        });
        downloadFile(reportContent, `全院业务分析_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain;charset=utf-8');
    };

    const handleExportPatientList = () => {
        if (patientList.length === 0) return;
        const headers = ['体检编号', '姓名', '性别', '年龄', '部门', '联系电话', '风险等级', '健康特征摘要'];
        const rows = patientList.map(p => [p.checkup_id, p.name, p.gender, p.age, p.department, p.phone || '', p.risk_level, `"${(p.assessment_data.summary || '').replace(/"/g, '""')}"`].join(','));
        const csvContent = "\uFEFF" + headers.join(',') + '\n' + rows.join('\n');
        downloadFile(csvContent, `${targetService}_名单.csv`, 'text/csv;charset=utf-8');
    };

    return (
        <div className="bg-white w-full h-full rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fadeIn relative">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><span>📊</span> 医院医疗服务热力图</h2>
                    <div className="flex items-center gap-2 mt-1">
                         <p className="text-sm text-slate-500">基于全院 {archives.length} 份档案挖掘</p>
                         {lastUpdated && <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isCachedData ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{isCachedData ? '📦 缓存' : '✨ 实时'} | {lastUpdated}</span>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportGlobalReport} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">导出报告</button>
                    <button onClick={handleManualRefresh} className="bg-white border border-slate-300 px-4 py-2 rounded-lg font-bold text-slate-600">重新分析</button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-teal-600">
                    <div className="text-4xl animate-spin mb-4">⚙️</div>
                    <p className="font-bold text-lg">AI 正在深度分析全院病理特征...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {analytics.map((dept, idx) => (
                                <button key={idx} onClick={() => setSelectedDept(dept)} className={`p-4 rounded-xl shadow-sm transition-all transform hover:scale-105 text-left relative overflow-hidden ${selectedDept?.departmentName === dept.departmentName ? 'ring-4 ring-blue-400' : ''} ${getHeatColor(dept.patientCount, maxCount)}`}>
                                    <div className="relative z-10">
                                        <div className="text-lg font-bold mb-1 truncate">{dept.departmentName}</div>
                                        <div className="text-3xl font-black mb-2">{dept.patientCount} <span className="text-xs font-normal opacity-80">人次</span></div>
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 text-6xl opacity-10">🏥</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col">
                        {selectedDept ? (
                            <div className="h-full flex flex-col p-6">
                                <h3 className="text-xl font-bold text-slate-800">{selectedDept.departmentName}</h3>
                                <div className="mt-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">潜力患者</div>
                                    <div className="text-2xl font-black text-blue-600">{selectedDept.patientCount}</div>
                                </div>
                                <div className="mt-6 flex-1 overflow-y-auto">
                                    <h4 className="font-bold text-teal-700 mb-3 text-xs flex items-center justify-between">
                                        <span>💡 建议开展项目</span>
                                        <span className="text-[10px] text-slate-400">双击挖掘客户</span>
                                    </h4>
                                    <ul className="space-y-3">
                                        {selectedDept.suggestedServices.map((srv, i) => (
                                            <li key={i} className="flex flex-col gap-1 bg-teal-50 p-3 rounded-lg border border-teal-100 cursor-pointer hover:bg-teal-100" onDoubleClick={() => handleServiceDoubleClick(typeof srv === 'string' ? srv : srv.name, typeof srv === 'string' ? '' : srv.description)}>
                                                <span className="text-slate-800 font-bold text-sm">{typeof srv === 'string' ? srv : srv.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50"><div className="text-6xl mb-4 opacity-50">👈</div><h3 className="text-lg font-bold">选择科室查看规划</h3></div>}
                    </div>
                </div>
            )}

            {showPatientModal && (
                <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white w-full max-w-2xl h-[80%] rounded-xl shadow-2xl flex flex-col animate-scaleIn">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <div><h3 className="text-lg font-bold">🔍 潜在人群: {targetService}</h3></div>
                            <div className="flex gap-2"><button onClick={handleExportPatientList} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded">📥 导出名单</button><button onClick={() => setShowPatientModal(false)} className="text-slate-400 font-bold text-xl px-2">×</button></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-2 border-b">姓名</th><th className="px-4 py-2 border-b">特征摘要</th><th className="px-4 py-2 border-b text-right">操作</th></tr></thead>
                                <tbody>
                                    {patientList.map(p => (
                                        <tr key={p.id} className="hover:bg-blue-50/50"><td className="px-4 py-3 font-bold">{p.name} ({p.age}岁)</td><td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[200px]">{p.assessment_data.summary}</td><td className="px-4 py-3 text-right"><button onClick={() => { if (onSelectPatient) { onSelectPatient(p); setShowPatientModal(false); } }} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold border border-indigo-200">查看</button></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};