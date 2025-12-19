import React, { useState, useEffect, useCallback } from 'react';
import { UserLayout } from './UserLayout';
import { UserHome } from './UserHome';
import { UserDietMotion } from './UserDietMotion';
import { UserMedicalServices } from './UserMedicalServices';
import { UserInteraction } from './UserInteraction';
import { UserProfile } from './UserProfile';
import { UserCommunity } from './UserCommunity';
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly, syncArchiveToLocal } from '../../services/dataService';
import { getUnreadCount } from '../../services/contentService';
import { HealthRecord } from '../../types';

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  // 修改初始 Tab 为 'home'，职工登录后直接进入健康仪表盘
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(true);
  const [userArchive, setUserArchive] = useState<HealthArchive | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUser = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const archive = await findArchiveByCheckupId(checkupId);
      if (archive) {
        setUserArchive(archive);
        syncArchiveToLocal(archive); 
      } else {
        alert('未找到您的档案，请联系管理员核对体检编号');
        onLogout();
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [checkupId, onLogout]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
      const checkUnread = async () => {
          if (!userArchive) return;
          const count = await getUnreadCount(userArchive.checkup_id);
          setUnreadCount(count);
      };

      if (userArchive) {
          checkUnread();
          const interval = setInterval(checkUnread, 5000);
          return () => clearInterval(interval);
      }
  }, [userArchive?.checkup_id]);

  // Fix: Corrected the handleUpdateRecord function to satisfy TypeScript's strict type requirements for HealthRecord and CheckupData
  const handleUpdateRecord = async (updatedData: any) => {
      if (!userArchive) return;
      
      // Fix: Remove optional chaining and fallbacks to ensure newCheckup type correctly matches CheckupData's required properties
      const newCheckup = {
          ...userArchive.health_record.checkup,
          basics: { ...userArchive.health_record.checkup.basics, ...updatedData.basics },
          labBasic: { ...userArchive.health_record.checkup.labBasic, ...updatedData.labBasic }
      };

      // Fix: Explicitly type newRecord to HealthRecord to resolve property assignment errors
      const newRecord: HealthRecord = { ...userArchive.health_record, checkup: newCheckup };
      setUserArchive({ ...userArchive, health_record: newRecord });
      
      try {
          await updateHealthRecordOnly(userArchive.checkup_id, newRecord);
      } catch (e) {
          console.error("Sync failed", e);
      }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">正在加载健康档案...</p>
      </div>
    );
  }

  if (!userArchive) return null;

  return (
    <UserLayout activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unreadCount}>
      {activeTab === 'home' && (
          <UserHome 
              profile={userArchive.health_record?.profile}
              assessment={userArchive.assessment_data}
              record={userArchive.health_record}
              dailyPlan={userArchive.custom_daily_plan}
              onNavigate={setActiveTab}
          />
      )}
      {activeTab === 'diet_motion' && (
          <UserDietMotion 
              assessment={userArchive.assessment_data} 
              userCheckupId={userArchive.checkup_id}
              record={userArchive.health_record}
              dailyPlan={userArchive.custom_daily_plan}
              onRefresh={() => loadUser(true)}
          />
      )}
      {activeTab === 'medical' && (
          <UserMedicalServices 
              userId={userArchive.checkup_id} 
              userName={userArchive.name} 
              assessment={userArchive.assessment_data} 
          />
      )}
      {activeTab === 'community' && (
          <UserCommunity 
              userId={userArchive.checkup_id}
              userName={userArchive.name}
              assessment={userArchive.assessment_data} 
          />
      )}
      {activeTab === 'interaction' && (
          <UserInteraction 
              userId={userArchive.checkup_id} 
              archive={userArchive} 
              onMessageRead={() => setUnreadCount(0)}
          />
      )}
      {activeTab === 'profile' && (
          <UserProfile 
              record={userArchive.health_record} 
              assessment={userArchive.assessment_data}
              dailyPlan={userArchive.custom_daily_plan}
              userId={userArchive.checkup_id}
              archive={userArchive}
              onUpdateRecord={handleUpdateRecord}
              onLogout={onLogout}
              onNavigate={setActiveTab}
          />
      )}
    </UserLayout>
  );
};