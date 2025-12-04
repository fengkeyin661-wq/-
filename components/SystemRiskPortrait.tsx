
import React, { useState, useEffect } from 'react';
import { HealthRecord, RiskAnalysisData, PredictionModelResult } from '../types';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
import { updateRiskAnalysis } from '../services/dataService';

interface Props {
    record: HealthRecord;
    existingAnalysis?: RiskAnalysisData;
    onUpdate: () => void; // Callback to refresh parent data
    hidePrintButton?: boolean; // New prop to control print button visibility
    showPortraits?: boolean; // Control visibility of the "Human Six Systems Portrait" section
}

export const SystemRiskPortrait: React.FC<Props> = ({ 
    record, 
    existingAnalysis, 
    onUpdate, 
    hidePrintButton = false,
    showPortraits = true // Default to true
}) => {
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
            // Even if calculated, allow viewing/editing inputs? 
            // For now, simplify to just fixing missing ones.
            alert(`${model.modelName}\n评分: ${model.score}\n结果: ${model.description}`);
        }
    };

    const handleSaveInputs = async () => {
        if (!activeModel || !analysis) return;
        setIsSaving(true);
        
        try {
            // 1. Merge new inputs into a temporary record object
            const tempExtras = { ...(record.riskModelExtras || {}), ...missingInputs };
            const tempRecord = { ...record, riskModelExtras: tempExtras };

            // 2. Re-evaluate models locally
            const newModels = evaluateRiskModels(tempRecord);
            const newPortraits = generateSystemPortraits(tempRecord);
            
            const newAnalysis = { portraits: newPortraits, models: newModels };
            setAnalysis(newAnalysis);

            // 3. Persist to DB
            await updateRiskAnalysis(record.profile.checkupId, newAnalysis, missingInputs);
            
            setActiveModel(null);
            onUpdate(); // Notify parent
        } catch (e) {
            alert("保存失败，请重试");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        if (!analysis) return;
        
        const printWindow = window.open('', '_blank', 'height=900,width=800');
        if (!printWindow) {
             alert("请允许弹窗以打印报告");
             return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>健康风险画像与系统评估报告</title>
                <style>
                    body { font-family: "PingFang SC", sans-serif; padding: 40px; color: #333; }
                    h1 { text-align: center; font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .meta { text-align: center; margin-bottom: 30px; color: #666; font-size: 14px; }
                    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 5px solid #0d9488; padding-left: 10px; margin-top: 30px; }
                    
                    /* Grid for Portraits */
                    .portrait-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .portrait-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; break-inside: avoid; }
                    .sys-name { font-weight: bold; font-size: 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
                    .status-tag { font-size: 12px; padding: 2px 6px; border-radius: 4px; border: 1px solid; margin-left: auto; }
                    .status-High { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }
                    .status-Medium { background: #fefce8; color: #d97706; border-color: #fcd34d; }
                    .status-Normal { background: #f0fdf4; color: #16a34a; border-color: #86efac; }
                    ul { padding-left: 20px; margin: 5px 0; font-size: 13px; }
                    
                    /* Table for Models */
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
                    th { background: #f9fafb; font-weight: bold; }
                    .risk-red { color: #dc2626; font-weight: bold; }
                    .risk-yellow { color: #d97706; font-weight: bold; }
                    .risk-green { color: #16a34a; }
                    
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1>健康风险画像与系统评估报告</h1>
                <div class="meta">
                    受检者: <strong>${record.profile.name}</strong> | 
                    性别: ${record.profile.gender} | 
                    年龄: ${record.profile.age}岁 | 
                    日期: ${new Date().toLocaleDateString()}
                </div>

                ${showPortraits ? `
                <div class="section-title">🧘 人体六大系统健康画像</div>
                <div class="portrait-grid">
                    ${analysis.portraits.map(p => `
                        <div class="portrait-card">
                            <div class="sys-name">
                                ${p.icon} ${p.systemName}
                                <span class="status-tag status-${p.status}">${p.status === 'High' ? '重点关注' : p.status === 'Medium' ? '一般关注' : '健康'}</span>
                            </div>
                            <ul>
                                ${p.keyFindings.length > 0 ? p.keyFindings.map(f => `<li>${f}</li>`).join('') : '<li style="color:#999">未见明显异常</li>'}
                            </ul>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div class="section-title">📊 疾病风险预测模型评估</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 20%">模型类别</th>
                            <th style="width: 25%">评估模型</th>
                            <th style="width: 15%">评分</th>
                            <th style="width: 15%">风险等级</th>
                            <th>结果解读</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.models.map(m => `
                            <tr>
                                <td>${m.category}</td>
                                <td><strong>${m.modelName}</strong></td>
                                <td>${m.score}</td>
                                <td class="${m.riskLevel === 'RED' ? 'risk-red' : m.riskLevel === 'YELLOW' ? 'risk-yellow' : 'risk-green'}">
                                    ${m.riskLabel}
                                </td>
                                <td>${m.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 50px; text-align: right; font-size: 14px;">
                    评估医师签名: ___________________
                </div>
                
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
            <div className="flex justify-between items-center">
                 {/* Empty div for spacing or title if needed */}
                 <div></div>
                 {!hidePrintButton && (
                    <button 
                        onClick={handlePrint}
                        className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 shadow-sm"
                    >
                        <span>🖨️</span> 打印评估报告
                    </button>
                 )}
            </div>
            
            {/* 1. 系统健康画像 (System Portraits) - Conditioned on prop */}
            {showPortraits && (
                <section className="print:break-inside-avoid">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="text-2xl">🧘</span> 人体六大系统健康画像
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analysis.portraits.map((sys, idx) => (
                            <div key={idx} className={`bg-white rounded-xl shadow-sm border p-5 transition-all hover:shadow-md ${
                                sys.status === 'High' ? 'border-red-200 bg-red-50/30' : 
                                sys.status === 'Medium' ? 'border-yellow-200 bg-yellow-50/30' : 'border-slate-100'
                            }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl">{sys.icon}</div>
                                        <h3 className="font-bold text-slate-700">{sys.systemName}</h3>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                        sys.status === 'High' ? 'bg-red-100 text-red-600 border-red-200' :
                                        sys.status === 'Medium' ? 'bg-yellow-100 text-yellow-600 border-yellow-200' :
                                        'bg-green-100 text-green-600 border-green-200'
                                    }`}>
                                        {sys.status === 'High' ? '重点关注' : sys.status === 'Medium' ? '一般关注' : '健康'}
                                    </span>
                                </div>
                                
                                <div className="mb-3 min-h-[60px]">
                                    {sys.keyFindings.length > 0 ? (
                                        <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                                            {sys.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">未发现明显异常</p>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">核心关注点</span>
                                    <div className="flex flex-wrap gap-1">
                                        {sys.focusAreas.map((focus, i) => (
                                            <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                {focus}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 2. 风险预测矩阵 (Risk Prediction Matrix) */}
            <section className="print:break-inside-avoid">
                 <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="text-2xl">📊</span> 疾病风险预测模型矩阵
                    <span className="text-xs font-normal text-slate-400 ml-2 bg-slate-100 px-2 py-1 rounded no-print">点击灰色卡片可补全数据进行评估</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {analysis.models.map((model) => (
                        <button 
                            key={model.modelId}
                            onClick={() => handleModelClick(model)}
                            className={`relative p-4 rounded-lg border text-left transition-all hover:scale-105 flex flex-col justify-between h-32 ${
                                model.riskLevel === 'RED' ? 'bg-red-500 text-white border-red-600 shadow-red-200' :
                                model.riskLevel === 'YELLOW' ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-yellow-200' :
                                model.riskLevel === 'GREEN' ? 'bg-green-500 text-white border-green-600 shadow-green-200' :
                                'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            } shadow-lg`}
                        >
                            <div>
                                <div className="text-xs opacity-80 mb-1">{model.category}</div>
                                <div className="font-bold text-sm leading-tight">{model.modelName}</div>
                            </div>
                            
                            <div className="mt-2">
                                {model.riskLevel === 'UNKNOWN' ? (
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                        <span>📝</span> 点击补全
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-2xl font-black">{model.riskLabel}</div>
                                        <div className="text-[10px] opacity-90 truncate">{model.score !== 'NA' && model.score}</div>
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
                        <p className="text-sm text-slate-500 mb-4">该模型需要以下额外数据才能进行准确评估：</p>
                        
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
                            <button 
                                onClick={handleSaveInputs}
                                disabled={isSaving}
                                className="px-6 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-700 shadow text-sm disabled:opacity-50"
                            >
                                {isSaving ? '正在评估...' : '提交并重新评估'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
