
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { LoginModal } from './components/LoginModal';
import { HospitalHeatmap } from './components/HospitalHeatmap';
// import { SystemRiskPortrait } from './components/SystemRiskPortrait'; // Removed Standalone
import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp, RiskAnalysisData } from './types'; 
import { generateHealthAssessment, generateFollowUpSchedule } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive, fetchArchives } from './services/dataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('followup');
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined); // New State
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [archives, setArchives] = useState<HealthArchive[]>([]);

  const refreshArchives = async () => {
      try {
          const data = await fetchArchives();
          setArchives(data);
      } catch (e) {
          console.error("Failed to refresh archives:", e);
      }
  };

  useEffect(() => {
      refreshArchives();
  }, []);

  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      setFollowUps(archive.follow_ups || []);
      setRiskAnalysis(archive.risk_analysis); // Load risk analysis
      
      if (mode === 'edit') {
          setActiveTab('survey');
      } else if (mode === 'followup') {
          setActiveTab('followup');
      } else {
          setActiveTab('assessment');
      }
  };

  const handleSurveySubmit = async (data: HealthRecord) => {
    setHealthRecord(data);
    setIsGenerating(true);
    try {
      const result = await generateHealthAssessment(data);
      setAssessment(result);
      
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      
      // Save (Risk analysis will be auto-generated in saveArchive if missing)
      const saveResult = await saveArchive(data, result, newSchedule, followUps);
      
      if (!saveResult.success) {
          throw new Error("保存失败: " + saveResult.message);
      }

      await refreshArchives();
      setActiveTab('assessment');
    } catch (error) {
      alert("处理失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAssessment = async (updatedAssessment: HealthAssessment) => {
      if (!healthRecord) return;
      setAssessment(updatedAssessment);
      try {
          const res = await saveArchive(healthRecord, updatedAssessment, schedule, followUps, riskAnalysis);
          if (!res.success) throw new Error(res.message);
          
          await refreshArchives();
          alert("评估方案已更新保存");
      } catch (e: any) {
          alert("保存失败: " + e.message);
      }
  };

  // Helper: Synchronize Follow-up Data back to Main Health Record
  const syncFollowUpToHealthRecord = (original: HealthRecord, latest: FollowUpRecord): HealthRecord => {
      const updated = JSON.parse(JSON.stringify(original)); // Deep copy
      
      // 1. Sync Basics (Weight, BP)
      if (latest.indicators.weight && latest.indicators.weight > 0) {
          updated.checkup.basics.weight = latest.indicators.weight;
      }
      if (latest.indicators.sbp && latest.indicators.sbp > 0) {
          updated.checkup.basics.sbp = latest.indicators.sbp;
      }
      if (latest.indicators.dbp && latest.indicators.dbp > 0) {
          updated.checkup.basics.dbp = latest.indicators.dbp;
      }
      
      // 2. Recalculate BMI if possible
      if (updated.checkup.basics.weight && updated.checkup.basics.height) {
          const h = updated.checkup.basics.height / 100;
          updated.checkup.basics.bmi = parseFloat((updated.checkup.basics.weight / (h * h)).toFixed(1));
      }

      // 3. Sync Glucose
      if (latest.indicators.glucose && latest.indicators.glucose > 0) {
          if (!updated.checkup.labBasic.glucose) updated.checkup.labBasic.glucose = {};
          // If the follow-up record is specifically Fasting (or not specified, assume fasting for simplicity in updates)
          if (latest.indicators.glucoseType === '空腹') {
               updated.checkup.labBasic.glucose.fasting = latest.indicators.glucose.toString();
          }
      }

      // 4. Sync Lipids
      if (latest.indicators.tc || latest.indicators.tg || latest.indicators.ldl || latest.indicators.hdl) {
          if (!updated.checkup.labBasic.lipids) updated.checkup.labBasic.lipids = {};
          if (latest.indicators.tc) updated.checkup.labBasic.lipids.tc = latest.indicators.tc.toString();
          if (latest.indicators.tg) updated.checkup.labBasic.lipids.tg = latest.indicators.tg.toString();
          if (latest.indicators.ldl) updated.checkup.labBasic.lipids.ldl = latest.indicators.ldl.toString();
          if (latest.indicators.hdl) updated.checkup.labBasic.lipids.hdl = latest.indicators.hdl.toString();
      }

      return updated;
  };

  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);
    
    // Update Schedule
    let updatedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
    const nextItem = generateNextScheduleItem(
        newRecord.date, 
        newRecord.assessment.nextCheckPlan || "", 
        newRecord.assessment.riskLevel
    );
    updatedSchedule = [...updatedSchedule, nextItem];
    setSchedule(updatedSchedule);

    // Sync Data to Health Archive
    let updatedHealthRecord = healthRecord;
    if (healthRecord) {
        // Create a synchronized version of the health record
        updatedHealthRecord = syncFollowUpToHealthRecord(healthRecord, newRecord);
        setHealthRecord(updatedHealthRecord); // Update local state immediately
    }

    if (healthRecord?.profile.checkupId) {
        await updateArchiveData(
            healthRecord.profile.checkupId, 
            updatedFollowUps, 
            updatedSchedule,
            updatedHealthRecord || undefined // Pass the updated record for persistence
        );
        await refreshArchives();
    }
  };

  const handleManualDataUpdate = async (updatedRecord: FollowUpRecord, updatedSchedule: ScheduledFollowUp[]) => {
      const updatedFollowUps = followUps.map(r => r.id === updatedRecord.id ? updatedRecord : r);
      setFollowUps(updatedFollowUps);
      setSchedule(updatedSchedule);

      if (healthRecord?.profile.checkupId) {
          // Note: We typically don't sync back on manual edits of old records to avoid overwriting newer data inadvertently,
          // unless we explicitely want to. For now, we just update the follow-up list.
          await updateArchiveData(healthRecord.profile.checkupId, updatedFollowUps, updatedSchedule);
          await refreshArchives();
      }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      isAuthenticated={isAuthenticated}
      onLoginClick={() => setShowLoginModal(true)}
      onLogoutClick={() => setIsAuthenticated(false)}
    >
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={() => {
            setIsAuthenticated(true);
            refreshArchives();
        }}
      />

      {activeTab === 'dashboard' && (
         <div className="text-center py-20 animate-fadeIn">
            <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">郑州大学医院健康管理系统 v3.0</h2>
            <p className="text-slate-500 mb-10 text-lg max-w-2xl mx-auto">
                基于 DeepSeek AI 引擎构建。<br/>
                集成 11项基础体检 + 20项自选项目 + 59项详细健康问卷的全维度健康档案。
            </p>
            <div className="flex justify-center gap-4">
                <button onClick={() => { setHealthRecord(null); setActiveTab('survey'); }} className="bg-white text-teal-600 border border-teal-200 px-8 py-3 rounded-lg hover:bg-teal-50 shadow-sm transition-all">
                    开始单人建档
                </button>
                <button 
                  onClick={() => {
                      if (isAuthenticated) setActiveTab('admin');
                      else setShowLoginModal(true);
                  }} 
                  className="bg-teal-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition-all transform hover:scale-105"
                >
                    {isAuthenticated ? '进入管理控制台' : '管理员登录'}
                </button>
            </div>
         </div>
      )}
      
      {activeTab === 'admin' && (
        <AdminConsole 
            isAuthenticated={isAuthenticated}
            onSelectPatient={handleSelectPatient} 
            onDataUpdate={refreshArchives} 
        />
      )}
      
      {activeTab === 'heatmap' && (
          <HospitalHeatmap archives={archives} onRefresh={refreshArchives} />
      )}
      
      <div className={activeTab === 'survey' ? 'block h-full' : 'hidden'}>
          <HealthSurvey onSubmit={handleSurveySubmit} initialData={healthRecord} isLoading={isGenerating} />
      </div>

      {activeTab === 'assessment' && assessment && healthRecord && (
        <AssessmentReport 
            assessment={assessment} 
            patientName={healthRecord.profile.name} 
            profile={healthRecord.profile}
            healthRecord={healthRecord}
            riskAnalysis={riskAnalysis}
            onSave={handleSaveAssessment}
            onReevaluate={() => setActiveTab('survey')}
            onUpdateRiskAnalysis={refreshArchives}
        />
      )}
      
      {activeTab === 'followup' && (
        <FollowUpDashboard 
            records={followUps} 
            assessment={assessment} 
            schedule={schedule} 
            onAddRecord={handleAddFollowUp}
            onUpdateData={handleManualDataUpdate}
            allArchives={archives}
            onPatientChange={(arch) => handleSelectPatient(arch, 'followup')}
            currentPatientId={healthRecord?.profile.checkupId}
        />
      )}
    </Layout>
  );
};

export default App;
