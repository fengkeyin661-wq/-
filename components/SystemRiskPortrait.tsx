
import React, { useState, useEffect } from 'react';
import { HealthRecord, RiskAnalysisData, PredictionModelResult, SystemRiskPortrait as SystemRiskPortraitType } from '../types';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
import { updateRiskAnalysis } from '../services/dataService';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface Props {
    record: HealthRecord;
    existingAnalysis?: RiskAnalysisData;
    onUpdate: () => void; // Callback to refresh parent data
    hidePrintButton?: boolean; 
}

export const SystemRiskPortrait: React.FC<Props> = ({ record, existingAnalysis, onUpdate, hidePrintButton = false }) => {
    const [analysis, setAnalysis] = useState<RiskAnalysisData | null>(null);
    const [activeModel, setActiveModel] = useState<PredictionModelResult | null>(null);
    const [missingInputs, setMissingInputs] = useState<{ [key: string]: string | number }>({});
    const [isSaving, setIsSaving] = useState(false);

    // Initialize or Calculate
    useEffect(() => {
        if (existingAnalysis) {
            setAnalysis(existingAnalysis);
        } else {
            // Initial calculation if not present
            const portraits = generateSystemPortraits(record);
            const models = evaluateRiskModels(record);
            setAnalysis({ portraits, models });
        }
    }, [record, existingAnalysis]);

    const handleModelClick = (model: PredictionModelResult) => {
        if (model.riskLevel === 'UNKNOWN') {
            setActiveModel(model);
            setMissingInputs({});
        } else {
            alert(`${model.modelName}\n评分: ${model.score}\n结果: ${model.description}`);
        }
    };

    const handleSaveInputs = async () => {
        if (!activeModel || !analysis) return;
        setIsSaving(true);
        try {
            const tempExtras = { ...(record.riskModelExtras || {}), ...missingInputs };
            const tempRecord = { ...record, riskModelExtras: tempExtras };
            const newModels = evaluateRiskModels(tempRecord);
            const newPortraits = generateSystemPortraits(tempRecord);
            const newAnalysis = { portraits: newPortraits, models: newModels };
            setAnalysis(newAnalysis);
            await updateRiskAnalysis(record.profile.checkupId, newAnalysis, missingInputs);
            setActiveModel(null);
            onUpdate();
        } catch (e) {
            alert("保存失败，请重试");
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate Total Score (Average of all systems)
    const totalScore = analysis ? Math.round(analysis.portraits.reduce((acc, curr) => acc + curr.score, 0) / analysis.portraits.length) : 0;

    // Prepare Radar Data
    const radarData = analysis?.portraits.map(p => ({
        subject: p.systemName.replace('系统', '').replace('风险监控', ''),
        A: p.score,
        fullMark: 100,
    })) || [];

    const handlePrint = () => {
        if (!analysis) return;
        const printWindow = window.open('', '_blank', 'height=900,width=800');
        if (!printWindow) { alert("请允许弹窗以打印报告"); return; }
        // Simple HTML for Print
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    .card { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
                    .high { border-left: 5px solid red; }
                    .med { border-left: 5px solid orange; }
                    .low { border-left: 5px solid green; }
                </style>
            </head>
            <body>
                <h1>人体系统健康画像</h1>
                <h2>综合健康评分: ${totalScore} 分</h2>
                ${analysis.portraits.map(p => `
                    <div class="card ${p.status === 'High' ? 'high' : p.status === 'Medium' ? 'med' : 'low'}">
                        <h3>${p.systemName} (${p.score}分)</h3>
                        <p><strong>主要发现:</strong> ${p.keyFindings.join(', ') || '无明显异常'}</p>
                        <p><strong>生活方式:</strong> ${p.lifestyleImpact?.join(', ') || '无特别关联'}</p>
                    </div>
                `).join('')}
                <script>window.print();</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    if (!analysis) return <div className="p-10 text-center">正在生成画像...</div>;

    return (
        <div className="animate-fadeIn pb-10 space-y-8">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-3xl">🧬</span> 
                    人体六大系统健康画像
                 </h2>
                 {!hidePrintButton && (
                    <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-sm">
                        <span>🖨️</span> 打印画像
                    </button>
                 )}
            </div>

            {/* Top Dashboard: Score + Radar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score Card */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-800 rounded-2xl p-6 text-white flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-indigo-200 text-sm font-bold uppercase tracking-wider mb-2">综合健康指数</div>
                        <div className="text-6xl font-black tracking-tight">{totalScore}</div>
                        <div className="mt-4 flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${totalScore >= 85 ? 'bg-green-500 text-white' : totalScore >= 70 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                                {totalScore >= 85 ? '健康状态良好' : totalScore >= 70 ? '亚健康预警' : '高风险状态'}
                            </span>
                        </div>
                    </div>
                    <div className="absolute right-[-20px] top-[-20px] text-9xl opacity-10">🛡️</div>
                </div>

                {/* Radar Chart */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex items-center justify-center relative">
                    <div className="absolute top-4 left-4 text-xs font-bold text-slate-400">系统均衡度分析</div>
                    <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="健康分" dataKey="A" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.5} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            
            {/* Detailed System Cards (Sorted by Score Ascending - Risk Descending) */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-700 text-lg">系统风险详情 (按严重程度排序)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {analysis.portraits.map((sys, idx) => (
                        <div key={idx} className={`rounded-xl shadow-sm border-t-4 p-5 bg-white transition-all hover:shadow-lg flex flex-col justify-between ${
                            sys.status === 'High' ? 'border-red-500' : 
                            sys.status === 'Medium' ? 'border-yellow-500' : 'border-green-500'
                        }`}>
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl bg-slate-50 w-12 h-12 rounded-lg flex items-center justify-center">{sys.icon}</div>
                                        <div>
                                            <h3 className="font-bold text-slate-700">{sys.systemName}</h3>
                                            <div className="text-xs text-slate-400">健康评分: <span className="font-bold text-slate-700">{sys.score}</span></div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-black ${
                                        sys.status === 'High' ? 'bg-red-100 text-red-600' : 
                                        sys.status === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                                        'bg-green-100 text-green-700'
                                    }`}>
                                        {sys.status === 'High' ? '高风险' : sys.status === 'Medium' ? '需关注' : '健康'}
                                    </span>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${sys.score < 60 ? 'bg-red-500' : sys.score < 85 ? 'bg-yellow-400' : 'bg-green-500'}`} 
                                        style={{ width: `${sys.score}%` }}
                                    ></div>
                                </div>

                                <div className="mb-4 space-y-3">
                                    <div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">主要发现</span>
                                        {sys.keyFindings.length > 0 ? (
                                            <ul className="text-sm text-slate-700 mt-1 space-y-1 list-disc pl-4 font-medium">
                                                {sys.keyFindings.map((f, i) => (
                                                    <li key={i} dangerouslySetInnerHTML={{ __html: f.replace(/(\d+(\.\d+)?)/g, '<b>$1</b>').replace(/(异常|高|低|阳性|癌|结节|硬化)/g, '<span class="text-red-600">$1</span>') }}></li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic mt-1">未发现明显异常指标</p>
                                        )}
                                    </div>
                                    
                                    {sys.lifestyleImpact && sys.lifestyleImpact.length > 0 && (
                                        <div className="bg-slate-50 p-2 rounded-lg">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">关联生活方式</span>
                                            <div className="flex flex-wrap gap-1">
                                                {sys.lifestyleImpact.map((factor, i) => (
                                                    <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded shadow-sm">
                                                        {factor}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-xs text-slate-400">建议关注</span>
                                <div className="flex gap-1">
                                    {sys.focusAreas.map((focus, i) => (
                                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">
                                            {focus}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Prediction Models Matrix (Keep as secondary info) */}
            <section className="print:break-inside-avoid pt-6 border-t border-slate-200">
                 <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="text-2xl">📊</span> 专项疾病预测模型
                 </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {analysis.models.map((model) => (
                        <button 
                            key={model.modelId}
                            onClick={() => handleModelClick(model)}
                            className={`p-3 rounded-lg border text-left transition-all hover:scale-105 flex flex-col justify-between h-28 ${
                                model.riskLevel === 'RED' ? 'bg-red-50 border-red-200 shadow-sm' :
                                model.riskLevel === 'YELLOW' ? 'bg-yellow-50 border-yellow-200 shadow-sm' :
                                model.riskLevel === 'GREEN' ? 'bg-green-50 border-green-200 shadow-sm' :
                                'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                        >
                            <div className="font-bold text-xs text-slate-600">{model.modelName}</div>
                            <div className="mt-1">
                                {model.riskLevel === 'UNKNOWN' ? (
                                    <div className="text-[10px] font-bold text-slate-400">点击补全数据</div>
                                ) : (
                                    <>
                                        <div className={`text-lg font-black ${
                                            model.riskLevel === 'RED' ? 'text-red-600' : model.riskLevel === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'
                                        }`}>{model.riskLabel}</div>
                                        <div className="text-[10px] opacity-70 truncate">{model.score !== 'NA' && model.score}</div>
                                    </>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* Input Modal */}
            {activeModel && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scaleIn">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg text-slate-800">完善变量: {activeModel.modelName}</h3>
                            <button onClick={() => setActiveModel(null)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
                        </div>
                        <div className="space-y-4 mb-6">
                            {activeModel.missingParams.map(param => (
                                <div key={param.key}>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">{param.label}</label>
                                    {param.label.includes('是/否') ? (
                                        <select 
                                            className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                                            onChange={e => setMissingInputs({...missingInputs, [param.key]: e.target.value})}
                                            value={missingInputs[param.key] || ''}
                                        >
                                            <option value="">请选择</option>
                                            <option value="是">是</option>
                                            <option value="否">否</option>
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded p-2 text-sm"
                                            placeholder="请输入数值或描述"
                                            value={missingInputs[param.key] || ''}
                                            onChange={e => setMissingInputs({...missingInputs, [param.key]: e.target.value})}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setActiveModel(null)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 text-sm">取消</button>
                            <button onClick={handleSaveInputs} disabled={isSaving} className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 shadow text-sm disabled:opacity-50">
                                {isSaving ? '正在评估...' : '提交并重新评估'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
