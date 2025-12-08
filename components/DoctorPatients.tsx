
import React, { useState, useEffect } from 'react';
import { fetchInteractions, updateInteractionStatus, InteractionItem } from '../services/contentService';
import { findArchiveByCheckupId, HealthArchive } from '../services/dataService';

interface Props {
    doctorId: string; // The ID of the currently logged-in doctor
    onSelectPatient: (archive: HealthArchive, mode: 'assessment' | 'followup') => void;
}

interface PatientData {
    interaction: InteractionItem;
    archive?: HealthArchive;
}

export const DoctorPatients: React.FC<Props> = ({ doctorId, onSelectPatient }) => {
    const [activeTab, setActiveTab] = useState<'signed' | 'pending'>('signed');
    const [list, setList] = useState<PatientData[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab, doctorId]);

    const loadData = async () => {
        setLoading(true);
        // 1. Fetch all signing interactions
        const interactions = await fetchInteractions('signing');
        
        // 2. Filter by doctorId and status
        const relevant = interactions.filter(i => {
            if (i.targetId !== doctorId) return false;
            if (activeTab === 'signed') return i.status === 'confirmed';
            if (activeTab === 'pending') return i.status === 'pending';
            return false;
        });

        // 3. Fetch Archive data for each user
        const fullList: PatientData[] = [];
        for (const inter of relevant) {
            // Assume userId in interaction maps to checkup_id or phone.
            // For this simulation, we use checkup_id matching
            let archive = await findArchiveByCheckupId(inter.userId);
            // If not found by ID, maybe try searching logic or just display basic info from interaction
            fullList.push({ interaction: inter, archive: archive || undefined });
        }

        setList(fullList);
        setLoading(false);
    };

    const handleAction = async (id: string, action: 'confirm' | 'reject' | 'terminate') => {
        let status: InteractionItem['status'] = 'pending';
        if (action === 'confirm') status = 'confirmed';
        else if (action === 'reject') status = 'cancelled';
        else if (action === 'terminate') status = 'cancelled'; // Or 'completed' if ended naturally

        if (confirm(`确定要${action === 'confirm' ? '同意' : action === 'reject' ? '拒绝' : '解约'}吗？`)) {
            await updateInteractionStatus(id, status);
            loadData();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span>🤝</span> 我的签约用户管理
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">管理您的家庭医生签约服务对象</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button 
                        onClick={() => setActiveTab('signed')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'signed' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        已签约 ({list.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        待审核申请
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {loading ? (
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                ) : list.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                        <span className="text-4xl mb-2">📭</span>
                        暂无{activeTab === 'signed' ? '签约用户' : '申请记录'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {list.map((item) => (
                            <div key={item.interaction.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-slate-600">
                                                {item.archive ? (item.archive.gender === '女' ? '👩' : '👨') : '👤'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg">
                                                    {item.archive?.name || item.interaction.userName}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {item.archive ? `${item.archive.age}岁 · ${item.archive.department}` : `ID: ${item.interaction.userId}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400">{item.interaction.date}</div>
                                            {item.archive && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border mt-1 inline-block ${
                                                    item.archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                                    item.archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                    'bg-green-50 text-green-600 border-green-200'
                                                }`}>
                                                    {item.archive.risk_level === 'RED' ? '高风险' : item.archive.risk_level === 'YELLOW' ? '中风险' : '低风险'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 mb-4 min-h-[40px]">
                                        <span className="font-bold">备注:</span> {item.interaction.details || '无'}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-slate-100">
                                    {activeTab === 'pending' ? (
                                        <>
                                            <button 
                                                onClick={() => handleAction(item.interaction.id, 'reject')}
                                                className="flex-1 py-1.5 rounded text-xs font-bold border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                            >
                                                拒绝
                                            </button>
                                            <button 
                                                onClick={() => handleAction(item.interaction.id, 'confirm')}
                                                className="flex-1 py-1.5 rounded text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                            >
                                                同意签约
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => handleAction(item.interaction.id, 'terminate')}
                                                className="px-3 py-1.5 rounded text-xs font-bold border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                                            >
                                                解约
                                            </button>
                                            {item.archive ? (
                                                <>
                                                    <button 
                                                        onClick={() => onSelectPatient(item.archive!, 'assessment')}
                                                        className="flex-1 py-1.5 rounded text-xs font-bold bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        健康档案
                                                    </button>
                                                    <button 
                                                        onClick={() => onSelectPatient(item.archive!, 'followup')}
                                                        className="flex-1 py-1.5 rounded text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                    >
                                                        随访管理
                                                    </button>
                                                </>
                                            ) : (
                                                <button disabled className="flex-1 py-1.5 bg-slate-100 text-slate-400 text-xs rounded cursor-not-allowed">
                                                    档案未关联
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
