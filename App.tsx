
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp } from './types'; 
import { generateHealthAssessment, generateFollowUpSchedule } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem, saveArchive } from './services/dataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);

  // Function to handle patient selection from Admin Console
  const handleSelectPatient = (archive: HealthArchive, mode: 'view' | 'edit' | 'followup' = 'view') => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      setFollowUps(archive.follow_ups || []);
      
      if (mode === 'edit') {
          setActiveTab('survey');
      } else if (mode === 'followup') {
          setActiveTab('followup');
      } else {
          setActiveTab('assessment');
      }
  };

  // Main Save Logic: Triggered when Survey is submitted (both New and Edit)
  const handleSurveySubmit = async (data: HealthRecord) => {
    setHealthRecord(data);
    setIsGenerating(true);
    try {
      // 1. Generate AI Assessment
      const result = await generateHealthAssessment(data);
      setAssessment(result);
      
      // 2. Generate Schedule (if new) or preserve existing logic if needed
      // For simplicity, we regenerate schedule based on new risk assessment, 
      // but in a real app you might want to merge with existing future schedules.
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      
      // 3. Save to Cloud Immediately
      // Pass existing follow-ups if we are updating a record, so we don't lose them
      await saveArchive(data, result, newSchedule, followUps);

      // 4. Navigate to Report
      setActiveTab('assessment');
    } catch (error) {
      alert("处理失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Adding Follow-up (and saving it)
  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);
    
    // 1. Mark current pending schedules as completed
    let updatedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
    
    // 2. Auto-generate NEXT schedule
    const nextItem = generateNextScheduleItem(
        newRecord.date, 
        newRecord.assessment.nextCheckPlan || "", 
        newRecord.assessment.riskLevel
    );
    updatedSchedule = [...updatedSchedule, nextItem];

    setSchedule(updatedSchedule);

    // 3. Sync to Cloud
    if (healthRecord?.profile.checkupId) {
        await updateArchiveData(healthRecord.profile.checkupId, updatedFollowUps, updatedSchedule);
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
         <div className="text-center py-20 animate-fadeIn">
            <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">职工健康管理系统 v3.0</h2>
            <p className="text-slate-500 mb-10 text-lg max-w-2xl mx-auto">
                基于 DeepSeek AI 引擎构建。<br/>
                集成 11项基础体检 + 20项自选项目 + 59项健康问卷的全维度健康档案。
            </p>
            <div className="flex justify-center gap-4">
                <button onClick={() => { setHealthRecord(null); setActiveTab('survey'); }} className="bg-white text-teal-600 border border-teal-200 px-8 py-3 rounded-lg hover:bg-teal-50 shadow-sm transition-all">
                    开始单人建档
                </button>
                <button onClick={() => setActiveTab('admin')} className="bg-teal-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition-all transform hover:scale-105">
                    进入管理控制台
                </button>
            </div>
         </div>
      )}
      {activeTab === 'admin' && <AdminConsole onSelectPatient={handleSelectPatient} />}
      {activeTab === 'survey' && <HealthSurvey onSubmit={handleSurveySubmit} initialData={healthRecord} isLoading={isGenerating} />}
      {activeTab === 'assessment' && assessment && healthRecord && (
        <AssessmentReport assessment={assessment} patientName={healthRecord.profile.name} />
      )}
      {activeTab === 'followup' && (
        <FollowUpDashboard records={followUps} assessment={assessment} schedule={schedule} onAddRecord={handleAddFollowUp} />
      )}
    </Layout>
  );
};

export default App;
