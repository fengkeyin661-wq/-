
import React, { useState } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { DailyHealthPlan, HealthArchive } from '../../services/dataService';

export interface UserProfileProps {
  record: HealthRecord;
  assessment?: HealthAssessment;
  dailyPlan?: DailyHealthPlan;
  userId: string;
  archive: HealthArchive;
  onUpdateRecord: (updatedData: any) => Promise<void>;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ record, onLogout, onUpdateRecord }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
      weight: record.checkup.basics.weight || 0,
      sbp: record.checkup.basics.sbp || 0,
      dbp: record.checkup.basics.dbp || 0
  });

  const handleSave = async () => {
      await onUpdateRecord({ basics: formData });
      setIsEditing(false);
  };

  return (
    <div className="space-y-12 animate-fadeIn pb-20">
      <header className="px-2 text-center mt-10">
        <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center text-6xl mb-8 border border-white mx-auto relative group">
          {record.profile.gender === '女' ? '👩' : '👨'}
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{record.profile.name}</h1>
        <p className="text-xs text-slate-400 font-black uppercase tracking-[0.3em] mt-3">{record.profile.department}</p>
      </header>

      <section className="bg-white rounded-[3rem] shadow-sm border border-white overflow-hidden divide-y divide-slate-50">
        <div className="p-8 flex justify-between items-center">
            <span className="font-black text-slate-800">当前体重</span>
            {isEditing ? (
                <input 
                    type="number" 
                    className="w-20 text-right border-b border-blue-500 outline-none" 
                    value={formData.weight} 
                    onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                />
            ) : (
                <span className="font-bold text-blue-600">{record.checkup.basics.weight} kg</span>
            )}
        </div>
      </section>

      <div className="px-2 flex gap-4">
        {isEditing ? (
            <button onClick={handleSave} className="flex-1 py-6 rounded-[2.5rem] bg-teal-600 text-white font-black text-sm shadow-lg">保存资料</button>
        ) : (
            <button onClick={() => setIsEditing(true)} className="flex-1 py-6 rounded-[2.5rem] bg-white text-slate-800 font-black text-sm border border-white shadow-sm">编辑资料</button>
        )}
        <button onClick={onLogout} className="flex-1 py-6 rounded-[2.5rem] bg-white text-rose-500 font-black text-sm border border-white shadow-sm">退出登录</button>
      </div>
    </div>
  );
};
