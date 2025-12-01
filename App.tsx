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
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisData | undefined>(undefined); 
  
  // New State: Track when the assessment was last updated locally to force UI refresh
  const [lastAssessmentUpdate, setLastAssessmentUpdate] = useState<number>(0);

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
      setRiskAnalysis(archive.risk_analysis); 
      setLastAssessmentUpdate(new Date(archive.updated_at || archive.created_at).getTime()); // Sync timestamp
      
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
      setLastAssessmentUpdate(Date.now()); // Update timestamp
      
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      
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
      setLastAssessmentUpdate(Date.now()); // Update timestamp
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
      
      // Ensure basic structure exists
      if (!updated.checkup) updated.checkup = {};
      if (!updated.checkup.basics) updated.checkup.basics = {};
      if (!updated.checkup.labBasic) updated.checkup.labBasic = {};

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
    if (!healthRecord) {
        alert("错误：缺少基础健康档案，无法进行数据同步与评估。");
        return;
    }

    const newRecord = { ...record, id: Date.now().toString() };
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);

    setIsGenerating(true); 

    try {
        console.log("🔄 开始闭环更新流程...");

        // 2. Sync Data
        const updatedHealthRecord = syncFollowUpToHealthRecord(healthRecord, newRecord);
        setHealthRecord(updatedHealthRecord); 
        console.log("✅ 1. 档案数据已同步");

        // 3. Re-Assessment
        const newAssessment = await generateHealthAssessment(updatedHealthRecord);
        setAssessment(newAssessment); 
        // CRITICAL: Force the UI to know there is a newer assessment than the record
        setLastAssessmentUpdate(Date.now()); 
        console.log("✅ 2. AI 风险重评估完成", newAssessment.riskLevel);

        // 4. Update Schedule
        const completedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
        const futureScheduleItems = generateFollowUpSchedule(newAssessment);
        const finalSchedule = [...completedSchedule, ...futureScheduleItems];
        setSchedule(finalSchedule); 
        console.log("✅ 3. 随访计划已更新");

        // 5. Save to DB
        const saveResult = await saveArchive(
            updatedHealthRecord, 
            newAssessment,       
            finalSchedule,      
            updatedFollowUps,    
            riskAnalysis         
        );

        if (!saveResult.success) {
            throw new Error(saveResult.message);
        }
        console.log("✅ 4. 数据库全量保存成功");

        // 6. Refresh and Switch Tab
        await refreshArchives();
        
        // Automatically switch to Assessment tab to show the new plan immediately
        setActiveTab('assessment');
        alert(`✅ 随访录入成功！\n\n已自动跳转至最新生成的“风险评估与健康方案”。`);

    } catch (e) {
        console.error("Auto-assessment loop failed:", e);
        alert("⚠️ 随访记录已保存，但AI自动评估流程失败: " + (e instanceof Error ? e.message : "网络超时"));
    } finally {
        setIsGenerating(false);
    }
  };

  const handleManualDataUpdate = async (updatedRecord: FollowUpRecord, updatedSchedule: ScheduledFollowUp[]) => {
      const updatedFollowUps = followUps.map(r => r.id === updatedRecord.id ? updatedRecord : r);
      setFollowUps(updatedFollowUps);
      setSchedule(updatedSchedule);

      if (healthRecord?.profile.checkupId) {
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
            lastAssessmentUpdate={lastAssessmentUpdate} // Pass the timestamp
        />
      )}
    </Layout>
  );
};

export default App;