
import React, { useState, useEffect, useCallback } from 'react';
import { UserLayout } from './UserLayout';
import { UserDietMotion } from './UserDietMotion';
import { UserHabits } from './UserHabits'; 
import { UserMedicalServices } from './UserMedicalServices';
import { UserInteraction } from './UserInteraction';
import { UserProfile } from './UserProfile';
import { UserCommunity } from './UserCommunity';
import { UserHome } from './UserHome';
import { UserButler } from './UserButler';
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly, syncArchiveToLocal } from '../../services/dataService';
import { getUnreadCount } from '../../services/contentService';

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [userArchive, setUserArchive] = useState<HealthArchive | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [showButler, setShowButler] = useState(false);

  const loadUser = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const archive = await findArchiveByCheckupId(checkupId);
      if (archive) {
        setUserArchive(archive);
        syncArchiveToLocal(archive); 
      } else {
        alert('未找到您的档案，请重新登录');
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

  const handleUpdateRecord = async (updatedData: any) => {
      if (!userArchive) return;
      const newRecord = { ...userArchive.health_record };
      newRecord.checkup.basics = { ...newRecord.checkup.basics, ...updatedData };
      setUserArchive({ ...userArchive, health_record: newRecord });
      await updateHealthRecordOnly(userArchive.checkup_id, newRecord);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Initializing Health Data</p>
      </div>
    );
  }

  if (!userArchive) return null;

  return (
    <UserLayout activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unreadCount}>
      
      {showButler && (
          <UserButler 
            record={userArchive.health_record}
            assessment={userArchive.assessment_data}
            userId={userArchive.checkup_id}
            onClose={() => setShowButler(false)}
            onNavigate={(tab) => { setActiveTab(tab); setShowButler(false); }}
          />
      )}

      {activeTab === 'home' && (
          <UserHome 
             profile={userArchive.health_record.profile} 
             assessment={userArchive.assessment_data} 
             onOpenButler={() => setShowButler(true)}
          />
      )}
      {activeTab === 'habits' && (
          <UserHabits 
              assessment={userArchive.assessment_data}
              userCheckupId={userArchive.checkup_id}
              record={userArchive.health_record}
              onRefresh={() => loadUser(true)}
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
