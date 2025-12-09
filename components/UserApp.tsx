
import React, { useState, useEffect } from 'react';
import { UserLayout } from './user/UserLayout';
import { UserDietMotion } from './user/UserDietMotion';
import { UserMedicalServices } from './user/UserMedicalServices';
import { UserInteraction } from './user/UserInteraction';
import { UserProfile } from './user/UserProfile';
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly } from '../services/dataService';
import { getUnreadCount } from '../services/contentService'; // Import

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('diet_motion');
  const [loading, setLoading] = useState(true);
  const [userArchive, setUserArchive] = useState<HealthArchive | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Poll for unread messages
  useEffect(() => {
      const checkUnread = async () => {
          if (!userArchive) return;
          // Count messages where receiver is user (from any doctor, but usually signed one)
          const count = await getUnreadCount(userArchive.checkup_id);
          setUnreadCount(count);
      };

      if (userArchive) {
          checkUnread();
          const interval = setInterval(checkUnread, 5000);
          return () => clearInterval(interval);
      }
  }, [userArchive]);

  const handleUpdateRecord = async (updatedData: any) => {
      if (!userArchive) return;
      
      const newCheckup = {
          ...userArchive.health_record.checkup,
          basics: { ...userArchive.health_record.checkup.basics, ...updatedData.basics },
          labBasic: { ...userArchive.health_record.checkup.labBasic, ...updatedData.labBasic }
      };

      const newRecord = { ...userArchive.health_record, checkup: newCheckup };
      
      // Update local state
      const newArchive = { ...userArchive, health_record: newRecord };
      setUserArchive(newArchive);
      
      try {
          // Sync to backend
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
    <UserLayout activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unreadCount}>
      {activeTab === 'diet_motion' && (
          <UserDietMotion 
              assessment={userArchive.assessment_data} 
              userCheckupId={userArchive.checkup_id}
          />
      )}
      {activeTab === 'medical' && (
          <UserMedicalServices 
              userId={userArchive.checkup_id} 
              userName={userArchive.name} 
          />
      )}
      {activeTab === 'interaction' && (
          <UserInteraction 
              userId={userArchive.checkup_id} 
              archive={userArchive} 
              onMessageRead={() => setUnreadCount(0)} // Callback to clear badge instantly
          />
      )}
      {activeTab === 'profile' && (
          <UserProfile 
              record={userArchive.health_record} 
              assessment={userArchive.assessment_data}
              dailyPlan={userArchive.custom_daily_plan}
              userId={userArchive.checkup_id}
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
