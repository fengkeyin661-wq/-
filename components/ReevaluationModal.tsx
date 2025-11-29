
import React, { useState } from 'react';
import { HealthRecord } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    originalRecord: HealthRecord;
    onSubmit: (newText: string) => void;
    isProcessing: boolean;
}

export const ReevaluationModal: React.FC<Props> = ({ isOpen, onClose, originalRecord, onSubmit, isProcessing }) => {
    const [additionalText, setAdditionalText] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[80] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-0 animate-scaleIn flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span>🔄</span> 档案更新与重新评估
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            当前操作对象: <span className="font-bold text-slate-700">{originalRecord.profile.name}</span> ({originalRecord.profile.checkupId})
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-2">×</button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800">
                        <p className="font-bold mb-1">ℹ️ 操作说明</p>
                        <p>系统将保留原有的体检和问卷数据。请在下方输入框中录入<strong>新的补充信息</strong>（例如：最新的复查结果、新发现的症状、生活方式的改变等）。AI 将自动合并新旧数据并重新生成风险评估报告。</p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2">新增/补充健康信息</label>
                        <textarea 
                            className="w-full h-64 border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono leading-relaxed"
                            placeholder="请在此输入补充信息...
例如：
1. 复查空腹血糖 6.5mmol/L，较之前下降。
2. 血压控制在 130/80mmHg。
3. 最近开始规律运动，每周跑步3次。"
                            value={additionalText}
                            onChange={e => setAdditionalText(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-sm"
                        disabled={isProcessing}
                    >
                        取消
                    </button>
                    <button 
                        onClick={() => onSubmit(additionalText)}
                        disabled={!additionalText.trim() || isProcessing}
                        className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-all"
                    >
                        {isProcessing ? (
                            <>
                                <span className="animate-spin">⏳</span> 正在合并数据并评估...
                            </>
                        ) : (
                            <>
                                <span>🚀</span> 更新存档并评估
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
