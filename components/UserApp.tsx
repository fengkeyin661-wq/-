
import React, { useState, useEffect } from 'react';
import { UserLayout } from './user/UserLayout';
import { UserHome } from './user/UserHome';
import { UserHealth } from './user/UserHealth';
import { UserServices } from './user/UserServices';
import { UserDiscover } from './user/UserDiscover';
import { HealthArchive, findArchiveByCheckupId } from '../services/dataService';
import { HealthProfile, HealthAssessment, RiskAnalysisData, HealthRecord } from '../types';

interface Props {
  checkupId: string;
  onLogout: () => void;
}

export const UserApp: React.FC<Props> = ({ checkupId, onLogout }) => {
  const [activeTab, setActiveTab] = useState('home');
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
      {activeTab === 'home' && (
        <UserHome 
          profile={userArchive.health_record.profile} 
          assessment={userArchive.assessment_data} 
        />
      )}
      
      {activeTab === 'health' && (
        <UserHealth 
          record={userArchive.health_record}
          assessment={userArchive.assessment_data}
          riskAnalysis={userArchive.risk_analysis}
        />
      )}
      
      {activeTab === 'services' && <UserServices />}
      
      {activeTab === 'discover' && <UserDiscover />}
      
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
