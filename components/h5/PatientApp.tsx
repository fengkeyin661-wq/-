
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';
import { PatientDashboard } from './PatientDashboard';
import { PatientReportView } from './PatientReportView';
import { PatientServices } from './PatientServices';
import { PatientProfile } from './PatientProfile';

interface Props {
    archive: HealthArchive;
    onLogout: () => void;
}

export const PatientApp: React.FC<Props> = ({ archive, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'home' | 'report' | 'services' | 'profile'>('home');

    return (
        <div className="bg-slate-50 min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                {activeTab === 'home' && <PatientDashboard archive={archive} onViewReport={() => setActiveTab('report')} />}
                
                {activeTab === 'report' && <PatientReportView archive={archive} />}
                
                {activeTab === 'services' && <PatientServices archive={archive} />}
                
                {activeTab === 'profile' && <PatientProfile archive={archive} onLogout={onLogout} />}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 pb-safe pt-2 px-6 flex justify-between items-center z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
                <NavBtn 
                    icon={activeTab === 'home' ? "🏠" : "🏡"} 
                    label="健康概览" 
                    active={activeTab === 'home'} 
                    onClick={() => setActiveTab('home')} 
                />
                <NavBtn 
                    icon={activeTab === 'report' ? "📋" : "📄"} 
                    label="我的档案" 
                    active={activeTab === 'report'} 
                    onClick={() => setActiveTab('report')} 
                />
                <NavBtn 
                    icon={activeTab === 'services' ? "🏥" : "🏩"} 
                    label="医疗服务" 
                    active={activeTab === 'services'} 
                    onClick={() => setActiveTab('services')} 
                    badge={archive.risk_level === 'RED' ? '1' : undefined}
                />
                <NavBtn 
                    icon={activeTab === 'profile' ? "👤" : "🙂"} 
                    label="个人中心" 
                    active={activeTab === 'profile'} 
                    onClick={() => setActiveTab('profile')} 
                />
            </div>
        </div>
    );
};

const NavBtn = ({ icon, label, active, onClick, badge }: any) => (
    <button onClick={onClick} className="relative flex flex-col items-center gap-1 p-2 w-16 transition-all active:scale-95">
        <span className={`text-2xl transition-transform duration-300 ${active ? 'scale-110 -translate-y-1' : 'grayscale opacity-60'}`}>
            {icon}
        </span>
        <span className={`text-[10px] font-bold transition-colors ${active ? 'text-teal-600' : 'text-slate-400'}`}>
            {label}
        </span>
        {badge && (
            <span className="absolute top-1 right-2 w-3 h-3 bg-red-500 rounded-full border border-white"></span>
        )}
    </button>
);
