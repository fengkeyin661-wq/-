import React, { useState, useEffect } from 'react';
import { UserLayout } from './user/UserLayout';
import { UserDiet } from './user/UserDiet';
import { UserExercise } from './user/UserExercise';
import { UserMedical } from './user/UserMedical';
import { UserProfile } from './user/UserProfile';
import { UserCommunity } from './user/UserCommunity';
import { HealthArchive, findArchiveByCheckupId, updateHealthRecordOnly, updateExercisePlan, ExercisePlanData } from '../services/dataService';
import { generateHealthAssessment } from '../services/geminiService';

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('diet');
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
      // Optimistic update
      setUserArchive({ ...userArchive, health_record: newRecord });
      
      try {
          // Re-assess since data changed
          const newAssessment = await generateHealthAssessment(newRecord);
          // Sync to DB
          await updateHealthRecordOnly(userArchive.checkup_id, newRecord);
      } catch (e) {
          console.error("Sync failed", e);
      }
  };

  const handleSaveExercisePlan = async (plan: ExercisePlanData) => {
      if (!userArchive) return;
      
      // Optimistic update
      setUserArchive({ ...userArchive, custom_exercise_plan: plan });
      
      try {
          await updateExercisePlan(userArchive.checkup_id, plan);
      } catch (e) {
          console.error("Plan save failed", e);
          alert("保存失败，请检查网络");
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
      {activeTab === 'diet' && <UserDiet />}
      {activeTab === 'exercise' && (
          <UserExercise 
              savedPlan={userArchive.custom_exercise_plan}
              onSavePlan={handleSaveExercisePlan}
          />
      )}
      {activeTab === 'community' && <UserCommunity />}
      {activeTab === 'medical' && <UserMedical />}
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