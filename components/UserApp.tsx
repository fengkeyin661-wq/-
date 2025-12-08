
import React, { useState, useEffect } from 'react';
import { UserLayout } from './user/UserLayout';
import { UserDietMotion } from './user/UserDietMotion'; // New
import { UserMedicalServices } from './user/UserMedicalServices'; // New
import { UserInteraction } from './user/UserInteraction'; // New
import { UserProfile } from './user/UserProfile'; // Updated
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly } from '../services/dataService';
import { generateHealthAssessment } from '../services/geminiService';

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('diet_motion');
  const [loading, setLoading] = useState(true);
  const [userArchive, setUserArchive] = useState<HealthArchive | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        const archive = await findArchiveByCheckupId(checkupId);
        if (archive) {
          setUserArchive(archive);
        } else {
          alert('未找到您的档案，请联系管理员核对体检编号');
          onLogout();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [checkupId]);

  const handleUpdateRecord = async (updatedData: any) => {
      if (!userArchive) return;
      const newRecord = { ...userArchive.health_record, ...updatedData };
      setUserArchive({ ...userArchive, health_record: newRecord });
      try {
          const newAssessment = await generateHealthAssessment(newRecord);
          await updateHealthRecordOnly(userArchive.checkup_id, newRecord);
      } catch (e) {
          console.error("Sync failed", e);
      }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">正在加载您的健康数据...</p>
      </div>
    );
  }

  if (!userArchive) return null;

  return (
    <UserLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'diet_motion' && <UserDietMotion assessment={userArchive.assessment_data} />}
      {activeTab === 'medical' && <UserMedicalServices />}
      {activeTab === 'interaction' && <UserInteraction />}
      {activeTab === 'profile' && (
          <UserProfile 
              record={userArchive.health_record} 
              assessment={userArchive.assessment_data}
              onUpdateRecord={handleUpdateRecord}
          />
      )}
      
      {/* Logout Overlay Button (Top Right) */}
      <button 
        onClick={onLogout}
        className="absolute top-4 right-4 z-50 bg-white/80 p-2 rounded-full shadow-sm backdrop-blur-sm text-xs font-bold text-slate-500 hover:text-red-500"
      >
        退出
      </button>
    </UserLayout>
  );
};
