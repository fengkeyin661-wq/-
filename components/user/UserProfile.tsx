
import React from 'react';
import { HealthRecord, HealthAssessment } from '../../types';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  onLogout: () => void;
}

export const UserProfile: React.FC<Props> = ({ record, assessment, onLogout }) => {
  return (
    <div className="space-y-12 animate-fadeIn pb-20">
      <header className="px-2 text-center mt-10">
        <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center text-6xl mb-8 border border-white mx-auto relative group">
          {record.profile.gender === '女' ? '👩' : '👨'}
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center border-4 border-[#F2F2F7] text-white">
            ✏️
          </div>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{record.profile.name}</h1>
        <p className="text-xs text-slate-400 font-black uppercase tracking-[0.3em] mt-3">{record.profile.department}</p>
      </header>

      {/* Account Settings: System Style Stack */}
      <section className="bg-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-white overflow-hidden divide-y divide-slate-50">
        <ProfileLink icon="📄" label="电子档案" detail="最新报告已更新" />
        <ProfileLink icon="🗓️" label="我的挂号" detail="3 个预约中" />
        <ProfileLink icon="🛡️" label="隐私协议" />
        <ProfileLink icon="⚙️" label="通用设置" />
      </section>

      {/* Danger Zone */}
      <div className="px-2">
        <button 
          onClick={onLogout}
          className="w-full py-6 rounded-[2.5rem] bg-white text-rose-500 font-black text-sm transition-all hover:bg-rose-50 border border-white shadow-sm active:scale-[0.98]"
        >
          退出当前登录
        </button>
      </div>

      <footer className="text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">郑州大学医院健康管理部</p>
        <p className="text-[8px] font-black text-slate-200 mt-2">BUILD 2024.11.02 · VER 1.5.0</p>
      </footer>
    </div>
  );
};

const ProfileLink = ({ icon, label, detail }: any) => (
  <div className="p-8 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors active:px-9 duration-300">
    <div className="flex items-center gap-5">
      <span className="text-2xl">{icon}</span>
      <span className="font-black text-slate-800 tracking-tight">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {detail && <span className="text-xs font-bold text-slate-300">{detail}</span>}
      <span className="text-slate-200 text-2xl font-light">›</span>
    </div>
  </div>
);
