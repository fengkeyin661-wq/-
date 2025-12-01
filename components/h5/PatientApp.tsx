
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';
import { PatientDashboard } from './PatientDashboard';
import { PatientReportView } from './PatientReportView';

interface Props {
    archive: HealthArchive;
    onLogout: () => void;
}

export const PatientApp: React.FC<Props> = ({ archive, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'home' | 'report' | 'profile'>('home');

    return (
        <div className="bg-slate-50 min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                {activeTab === 'home' && <PatientDashboard archive={archive} onViewReport={() => setActiveTab('report')} />}
                
                {activeTab === 'report' && <PatientReportView archive={archive} />}
                
                {activeTab === 'profile' && (
                    <div className="p-6 animate-fadeIn">
                        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 border border-slate-100">
                                {archive.gender === '女' ? '👩🏻' : '👨🏻'}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">{archive.name}</h2>
                            <p className="text-slate-500 text-sm">{archive.department}</p>
                            <div className="flex justify-center gap-2 mt-4">
                                <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-mono">
                                    ID: {archive.checkup_id}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                                <span className="font-bold text-slate-700">联系电话</span>
                                <span className="text-slate-500 font-mono">{archive.phone || '未预留'}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                                <span className="font-bold text-slate-700">年龄</span>
                                <span className="text-slate-500">{archive.age} 岁</span>
                            </div>
                             <div className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                                <span className="font-bold text-slate-700">最近建档</span>
                                <span className="text-slate-500 text-xs">
                                    {new Date(archive.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <button 
                            onClick={onLogout}
                            className="w-full mt-10 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors"
                        >
                            退出登录
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 pb-safe pt-2 px-6 flex justify-between items-center z-50">
                <NavBtn 
                    icon="🏠" label="健康概览" 
                    active={activeTab === 'home'} 
                    onClick={() => setActiveTab('home')} 
                />
                <NavBtn 
                    icon="📋" label="健康档案" 
                    active={activeTab === 'report'} 
                    onClick={() => setActiveTab('report')} 
                />
                <NavBtn 
                    icon="👤" label="个人中心" 
                    active={activeTab === 'profile'} 
                    onClick={() => setActiveTab('profile')} 
                />
            </div>
        </div>
    );
};

const NavBtn = ({ icon, label, active, onClick }: any) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1 p-2 w-16 transition-all">
        <span className={`text-2xl transition-transform ${active ? 'scale-110' : 'grayscale opacity-50'}`}>
            {icon}
        </span>
        <span className={`text-[10px] font-bold ${active ? 'text-teal-600' : 'text-slate-400'}`}>
            {label}
        </span>
    </button>
);
