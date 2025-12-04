
import React, { useState, useEffect, useRef } from 'react';
import { HealthAssessment, RiskLevel, HealthProfile, RiskAnalysisData, HealthRecord } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SystemRiskPortrait } from './SystemRiskPortrait';

interface Props {
  assessment: HealthAssessment;
  patientName?: string;
  profile?: HealthProfile;
  healthRecord?: HealthRecord; // Needed for SystemRiskPortrait
  riskAnalysis?: RiskAnalysisData; // New Prop
  onSave?: (newAssessment: HealthAssessment) => void;
  onUpdateReport?: (file: File) => void; // Changed from onReevaluate to file upload handler
  onUpdateRiskAnalysis?: () => void; // Prop to refresh archives if models are updated
  onSupplementQuestionnaire?: () => void; // Add Supplement Questionnaire Callback
}

const COLORS = {
  [RiskLevel.GREEN]: '#22c55e',
  [RiskLevel.YELLOW]: '#eab308',
  [RiskLevel.RED]: '#ef4444',
};

export const AssessmentReport: React.FC<Props> = ({ 
    assessment, 
    patientName, 
    profile, 
    healthRecord,
    riskAnalysis, 
    onSave, 
    onUpdateReport,
    onUpdateRiskAnalysis,
    onSupplementQuestionnaire
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<HealthAssessment>(assessment);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when props change (e.g. switching patients)
  useEffect(() => {
      setEditData(assessment);
      setIsEditing(false);
  }, [assessment]);

  const riskColor = COLORS[editData.riskLevel];
  
  const riskData = [
    { name: '高风险', value: editData.risks.red.length, color: COLORS[RiskLevel.RED] },
    { name: '中风险', value: editData.risks.yellow.length, color: COLORS[RiskLevel.YELLOW] },
    { name: '正常', value: Math.max(1, 5 - editData.risks.red.length), color: COLORS[RiskLevel.GREEN] },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onUpdateReport) {
          onUpdateReport(file);
      }
      // Reset input value to allow re-uploading the same file if needed
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const handleUpdateClick = () => {
      fileInputRef.current?.click();
  };

  // Combined Print Window Logic
  const handlePrint = () => {
      setIsEditing(false);
      
      const printWindow = window.open('', '_blank', 'height=900,width=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
      
      if (!printWindow) {
          alert("浏览器拦截了弹窗，请允许本站弹出窗口以便打印。");
          return;
      }

      const riskLevelMap = { 'RED': '高风险', 'YELLOW': '中风险', 'GREEN': '低风险' };
      const riskLevelColorMap = { 'RED': '#fee2e2', 'YELLOW': '#fef9c3', 'GREEN': '#dcfce7' }; // bg colors
      const riskTextColorMap = { 'RED': '#991b1b', 'YELLOW': '#854d0e', 'GREEN': '#166534' }; // text colors
      
      const riskLevel = editData.riskLevel;
      const riskBg = riskLevelColorMap[riskLevel as keyof typeof riskLevelColorMap];
      const riskText = riskTextColorMap[riskLevel as keyof typeof riskTextColorMap];
      const riskLabel = riskLevelMap[riskLevel as keyof typeof riskLevelMap];

      const renderList = (items: string[]) => items.length > 0 
        ? `<ul class="list">${items.map(i => `<li>${i}</li>`).join('')}</ul>` 
        : '<p class="empty-text">无特定建议</p>';

      const criticalBanner = editData.isCritical ? `
          <div class="critical-banner">
              ⚠️ 危急值警示：${editData.criticalWarning || '存在严重异常指标，请立即处理！'}
          </div>
      ` : '';

      const pName = profile?.name || patientName || '未命名';
      const pGender = profile?.gender || '';
      const pAge = profile?.age ? `${profile.age}岁` : '';
      const pDept = profile?.department || '';

      // --- New: Generate HTML for Models ---
      let modelsHtml = '';

      if (riskAnalysis) {
          // Models HTML
          const modelsRows = riskAnalysis.models.map(m => `
            <tr>
                <td>${m.category}</td>
                <td><strong>${m.modelName}</strong></td>
                <td>${m.score}</td>
                <td class="${m.riskLevel === 'RED' ? 'risk-red' : m.riskLevel === 'YELLOW' ? 'risk-yellow' : 'risk-green'}">
                    ${m.riskLabel}
                </td>
                <td>${m.description}</td>
            </tr>
          `).join('');

          modelsHtml = `
            <div class="section-title">📊 疾病风险预测模型评估</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%">类别</th>
                        <th style="width: 25%">模型</th>
                        <th style="width: 15%">评分</th>
                        <th style="width: 15%">等级</th>
                        <th>解读</th>
                    </tr>
                </thead>
                <tbody>${modelsRows}</tbody>
            </table>
          `;
      }
      // -----------------------------------------------------

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>健康风险评估报告</title>
            <style>
                body {
                    font-family: "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif;
                    background-color: #fff;
                    color: #333;
                    margin: 0;
                    padding: 40px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .container { max-width: 800px; margin: 0 auto; }
                
                /* Header */
                .header {
                    text-align: center;
                    border-bottom: 2px solid #111827;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 { font-size: 20px; color: #4b5563; margin-bottom: 5px; font-weight: normal; }
                .header h2 { font-size: 28px; font-weight: 800; margin: 0; letter-spacing: 2px; color: #111827; }
                .meta-row { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; color: #4b5563; }

                /* Risk Banner */
                .risk-banner {
                    background-color: ${riskBg};
                    color: ${riskText};
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    margin-bottom: 30px;
                    border: 1px solid currentColor;
                }
                .risk-label { font-size: 24px; font-weight: 900; display: block; margin-bottom: 5px; }
                .risk-desc { font-size: 14px; opacity: 0.9; }

                .critical-banner {
                    background-color: #fef2f2;
                    color: #b91c1c;
                    border: 2px solid #ef4444;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 16px;
                }

                /* Sections */
                .section { margin-bottom: 25px; }
                .section-title {
                    font-size: 16px; font-weight: bold; border-left: 5px solid #0d9488;
                    padding-left: 10px; margin-bottom: 12px; color: #111827;
                    background-color: #f0fdfa; padding-top: 5px; padding-bottom: 5px;
                    margin-top: 25px;
                }
                
                .content-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; }

                /* Summary */
                .summary-text { font-size: 15px; text-align: justify; white-space: pre-line; }

                /* Risk Lists */
                .risk-grid { display: flex; gap: 20px; margin-bottom: 20px; }
                .risk-col { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
                .risk-header { padding: 8px 15px; font-weight: bold; font-size: 14px; }
                .rh-red { background-color: #fef2f2; color: #991b1b; }
                .rh-yellow { background-color: #fefce8; color: #854d0e; }
                .risk-body { padding: 15px; }

                /* Plan */
                .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .plan-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; }
                .plan-title { font-weight: bold; color: #0f766e; margin-bottom: 10px; font-size: 15px; border-bottom: 1px solid #ccfbf1; padding-bottom: 5px; }
                ul.list { padding-left: 20px; margin: 0; }
                ul.list li { margin-bottom: 4px; color: #374151; }
                .empty-text { color: #9ca3af; font-style: italic; }

                /* Risk Portrait Grid - Styles removed as section removed */
                
                /* Models Table */
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
                th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
                th { background: #f9fafb; font-weight: bold; }
                .risk-red { color: #dc2626; font-weight: bold; }
                .risk-yellow { color: #d97706; font-weight: bold; }
                .risk-green { color: #16a34a; }

                /* Footer */
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 20px; }
                .disclaimer-box { border-top: 2px solid #374151; padding-top: 15px; margin-top: 20px; text-align: center; }
                .disclaimer { font-weight: bold; font-size: 14px; color: #dc2626; margin-bottom: 8px; }
                .contact-info { font-size: 12px; color: #4b5563; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
                .contact-info span { display: inline-block; }

                @media print {
                    body { padding: 0; -webkit-print-color-adjust: exact; }
                    .plan-card, .risk-col, .disclaimer-box { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>郑州大学医院健康管理中心</h1>
                    <h2>健康风险评估与健康方案</h2>
                    <div class="meta-row">
                        <span>受检人: <strong>${pName}</strong> ${pGender} ${pAge}</span>
                        <span>部门: ${pDept}</span>
                        <span>评估日期: ${new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                ${criticalBanner}

                <div class="risk-banner">
                    <span class="risk-label">${riskLabel}</span>
                    <span class="risk-desc">根据您的体检数据与健康问卷综合判定</span>
                </div>

                <!-- Injected Models -->
                ${modelsHtml}

                <div class="section">
                    <div class="section-title">综合评估综述</div>
                    <div class="content-box summary-text">${editData.summary}</div>
                </div>

                <div class="risk-grid">
                    <div class="risk-col">
                        <div class="risk-header rh-red">🔴 高危因素</div>
                        <div class="risk-body">${renderList(editData.risks.red)}</div>
                    </div>
                    <div class="risk-col">
                        <div class="risk-header rh-yellow">🟡 中危因素</div>
                        <div class="risk-body">${renderList(editData.risks.yellow)}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">健康管理方案</div>
                    <div class="plan-grid">
                        <div class="plan-card">
                            <div class="plan-title">🥗 饮食干预</div>
                            ${renderList(editData.managementPlan.dietary)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">🏃 运动方案</div>
                            ${renderList(editData.managementPlan.exercise)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">💊 医疗建议</div>
                            ${renderList(editData.managementPlan.medication)}
                        </div>
                        <div class="plan-card">
                            <div class="plan-title">🔍 监测与随访</div>
                            ${renderList(editData.managementPlan.monitoring)}
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📅 随访计划建议</div>
                    <div class="content-box">
                        <p style="margin-bottom: 8px;"><strong>建议随访频率:</strong> ${editData.followUpPlan.frequency}</p>
                        <div>
                            <strong>重点复查项目:</strong>
                            <div style="margin-top: 5px;">
                                ${renderList(editData.followUpPlan.nextCheckItems)}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <div>评估医师签名: _________________</div>
                    <div>受检者确认: _________________</div>
                </div>
                
                <div class="disclaimer-box">
                    <p class="disclaimer">本方案仅供参考，具体治疗请遵医嘱。</p>
                    <div class="contact-info">
                        <span>制定机构：郑州大学医院</span>
                        <span>服务热线：0371-67739261</span>
                        <span>工作时间：周一至周五上午8:00-12:00，下午2:30-5:30</span>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 500);
                };
            </script>
        </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      if (printWindow.focus) printWindow.focus();
  };

  const handleSave = () => {
      if (onSave) {
          onSave(editData);
          setIsEditing(false);
      }
  };

  const handleArrayChange = (
      section: 'risks' | 'managementPlan' | 'followUpPlan', 
      subKey: string, 
      text: string
  ) => {
      const array = text.split('\n').filter(item => item.trim() !== '');
      setEditData(prev => {
          if (section === 'risks') {
              return { ...prev, risks: { ...prev.risks, [subKey]: array } };
          } else if (section === 'managementPlan') {
              return { ...prev, managementPlan: { ...prev.managementPlan, [subKey]: array } };
          } else if (section === 'followUpPlan') {
               if (subKey === 'nextCheckItems') {
                   return { ...prev, followUpPlan: { ...prev.followUpPlan, nextCheckItems: array } };
               }
          }
          return prev;
      });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="flex justify-end gap-3 no-print">
         {isEditing ? (
             <>
                <button onClick={() => setIsEditing(false)} className="px-5 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100">取消</button>
                <button onClick={handleSave} className="bg-teal-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-teal-700 shadow-lg">💾 保存修改</button>
             </>
         ) : (
             <>
                {/* Hidden File Input for Update Report */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileChange}
                />
                
                {onUpdateReport && (
                    <button 
                        onClick={handleUpdateClick} 
                        className="bg-white border border-indigo-200 text-indigo-700 px-5 py-2 rounded-lg font-bold hover:bg-indigo-50 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        📈 更新体检报告
                    </button>
                )}
                
                {onSupplementQuestionnaire && (
                    <button 
                        onClick={onSupplementQuestionnaire} 
                        className="bg-white border border-blue-200 text-blue-700 px-5 py-2 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        📝 补充问卷信息
                    </button>
                )}

                <button onClick={() => setIsEditing(true)} className="bg-white border border-teal-200 text-teal-700 px-5 py-2 rounded-lg font-medium hover:bg-teal-50 flex items-center gap-2">
                    ✏️ 医生修订
                </button>
                <button onClick={handlePrint} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-700 flex items-center gap-2">
                    🖨️ 打印报告
                </button>
             </>
         )}
      </div>
      
      {/* Patient Profile Card (Screen Only) */}
      {profile && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
             <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl border border-slate-200 shrink-0">
                    {profile.gender === '女' ? '👩🏻‍🦳' : '👨🏻‍🦳'}
                </div>
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-slate-800">{profile.name}</h2>
                        <span className={`px-2 py-0.5 text-xs rounded-full border font-bold ${
                            editData.riskLevel === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                            editData.riskLevel === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                            'bg-green-50 text-green-600 border-green-200'
                        }`}>
                            {editData.riskLevel === 'RED' ? '高风险' : editData.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                        </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1 flex gap-3 items-center">
                        <span>{profile.gender || '未知'}</span>
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span>{profile.age ? `${profile.age}岁` : '年龄未知'}</span>
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span className="font-mono text-slate-400">{profile.checkupId}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm w-full md:w-auto mt-2 md:mt-0 bg-slate-50 p-3 rounded-lg border border-slate-100 md:bg-transparent md:border-0 md:p-0">
                <div>
                    <span className="block text-xs text-slate-400 uppercase">部门/单位</span>
                    <span className="font-medium text-slate-700">{profile.department || '-'}</span>
                </div>
                <div>
                    <span className="block text-xs text-slate-400 uppercase">联系电话</span>
                    <span className="font-medium text-slate-700 font-mono">{profile.phone || '-'}</span>
                </div>
                <div>
                    <span className="block text-xs text-slate-400 uppercase">体检日期</span>
                    <span className="font-medium text-slate-700">{profile.checkupDate || '-'}</span>
                </div>
            </div>
        </div>
      )}

      {/* Embedded Risk Portrait Section (Models Only) */}
      {healthRecord && (
          <div className="mb-8 print:hidden">
              <SystemRiskPortrait 
                  record={healthRecord} 
                  existingAnalysis={riskAnalysis} 
                  onUpdate={() => onUpdateRiskAnalysis && onUpdateRiskAnalysis()}
                  hidePrintButton={true}
                  showPortraits={false} // Only show prediction models
              />
          </div>
      )}

      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-3xl font-bold">健康风险评估与方案</h1>
          <div className="mt-4 text-sm">受检人: <span className="font-bold text-lg">{patientName}</span></div>
      </div>

      {isEditing && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm text-yellow-800 flex items-center gap-2 animate-pulse">
              <span>⚠️ 编辑模式：您可以直接修改下方的文本内容，修改完成后请点击右上角“保存”。</span>
          </div>
      )}

      {/* Critical Value Alert Banner */}
      {editData.isCritical && (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-6 shadow-md animate-pulse">
              <div className="flex items-center gap-3">
                  <span className="text-3xl">🚨</span>
                  <div>
                      <h3 className="text-lg font-bold text-red-700">危急值警示 (Critical Value)</h3>
                      <p className="text-red-800 font-bold">{editData.criticalWarning || "系统检测到严重异常结果，请立即进行临床干预！"}</p>
                  </div>
              </div>
          </div>
      )}

      {/* Summary Section */}
      <div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row items-start gap-8 print:shadow-none print:border">
        <div className="w-32 h-32 flex-shrink-0 mx-auto md:mx-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={riskData} innerRadius={40} outerRadius={60} dataKey="value">
                {riskData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full">
          <div className="flex items-center gap-4 mb-3">
              <h2 className="text-xl font-bold">综合评估: </h2>
              {isEditing ? (
                  <select 
                    value={editData.riskLevel} 
                    onChange={e => setEditData({...editData, riskLevel: e.target.value as RiskLevel})}
                    className="border border-slate-300 rounded p-1 text-sm font-bold"
                  >
                      <option value={RiskLevel.GREEN}>低风险</option>
                      <option value={RiskLevel.YELLOW}>中风险</option>
                      <option value={RiskLevel.RED}>高风险</option>
                  </select>
              ) : (
                  <span className="text-xl font-bold" style={{ color: riskColor }}>
                    {editData.riskLevel === 'RED' ? '高风险' : editData.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                  </span>
              )}
          </div>
          
          {isEditing ? (
              <textarea 
                  className="w-full border border-slate-300 rounded p-2 text-sm text-slate-700 h-32 focus:ring-2 focus:ring-teal-500"
                  value={editData.summary}
                  onChange={e => setEditData({...editData, summary: e.target.value})}
              />
          ) : (
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{editData.summary}</p>
          )}
        </div>
      </div>

      {/* Risk Factors Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
             <h3 className="font-bold text-red-700 mb-2">🔴 高危因素</h3>
             {isEditing ? (
                 <textarea 
                     className="w-full bg-white border border-red-200 rounded p-2 text-sm h-32"
                     value={editData.risks.red.join('\n')}
                     onChange={e => handleArrayChange('risks', 'red', e.target.value)}
                     placeholder="每行输入一个风险点"
                 />
             ) : (
                 <ul className="list-disc pl-5 text-sm text-red-800 space-y-1">
                     {editData.risks.red.length > 0 ? editData.risks.red.map((r,i)=><li key={i}>{r}</li>) : <li>无明显高危因素</li>}
                 </ul>
             )}
          </div>
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
             <h3 className="font-bold text-yellow-700 mb-2">🟡 中危因素</h3>
             {isEditing ? (
                 <textarea 
                     className="w-full bg-white border border-yellow-200 rounded p-2 text-sm h-32"
                     value={editData.risks.yellow.join('\n')}
                     onChange={e => handleArrayChange('risks', 'yellow', e.target.value)}
                     placeholder="每行输入一个风险点"
                 />
             ) : (
                 <ul className="list-disc pl-5 text-sm text-yellow-800 space-y-1">
                     {editData.risks.yellow.length > 0 ? editData.risks.yellow.map((r,i)=><li key={i}>{r}</li>) : <li>无明显中危因素</li>}
                 </ul>
             )}
          </div>
      </div>

      {/* Management Plan Section */}
      <div className="bg-white p-6 rounded shadow border print:shadow-none">
          <h3 className="font-bold text-lg mb-4 bg-slate-800 text-white p-2 rounded print:text-black print:bg-transparent print:border-b">健康管理方案</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
             <div className="space-y-4">
                 <PlanSection 
                    title="🥗 饮食干预" color="teal" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.dietary}
                    onChange={(val) => handleArrayChange('managementPlan', 'dietary', val)}
                 />
                 <PlanSection 
                    title="🏃 运动方案" color="teal" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.exercise}
                    onChange={(val) => handleArrayChange('managementPlan', 'exercise', val)}
                 />
             </div>
             <div className="space-y-4">
                 <PlanSection 
                    title="💊 医疗建议" color="blue" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.medication}
                    onChange={(val) => handleArrayChange('managementPlan', 'medication', val)}
                 />
                 <PlanSection 
                    title="🔍 监测与随访" color="blue" 
                    isEditing={isEditing} 
                    items={editData.managementPlan.monitoring}
                    onChange={(val) => handleArrayChange('managementPlan', 'monitoring', val)}
                 />
             </div>
          </div>
      </div>
      
      {/* Follow-up Plan Section */}
      <div className="bg-blue-50 p-6 rounded border border-blue-200 print:bg-transparent print:border-slate-300">
          <h3 className="font-bold text-blue-800 mb-2">📅 随访计划建议</h3>
          <div className="mb-2 flex items-center gap-2">
             <span className="text-sm text-blue-900 font-bold">建议频率:</span>
             {isEditing ? (
                 <input 
                    type="text" 
                    className="border border-blue-300 rounded px-2 py-1 text-sm w-48"
                    value={editData.followUpPlan.frequency}
                    onChange={e => setEditData({...editData, followUpPlan: {...editData.followUpPlan, frequency: e.target.value}})}
                 />
             ) : (
                 <span className="text-sm text-blue-900">{editData.followUpPlan.frequency}</span>
             )}
          </div>
          
          <div className="text-sm text-blue-900">
              <div className="font-bold mb-1">重点复查项目:</div>
              {isEditing ? (
                  <textarea 
                     className="w-full border border-blue-300 rounded p-2 text-sm h-20"
                     value={editData.followUpPlan.nextCheckItems.join('\n')}
                     onChange={e => handleArrayChange('followUpPlan', 'nextCheckItems', e.target.value)}
                     placeholder="每行输入一个复查项目"
                  />
              ) : (
                  <div>{editData.followUpPlan.nextCheckItems.join('、')}</div>
              )}
          </div>
      </div>

      {/* Signature for Print */}
      <div className="hidden print:flex justify-between mt-12 pt-8 border-t border-slate-300">
          <div>医生签名: _________________</div>
          <div>日期: {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
};

// Helper Component for Plan Sections
const PlanSection: React.FC<{
    title: string; 
    color: string; 
    isEditing: boolean; 
    items: string[]; 
    onChange: (val: string) => void;
}> = ({ title, color, isEditing, items, onChange }) => (
    <div>
        <h4 className={`font-bold text-${color}-600 border-b border-${color}-100 pb-1 mb-2`}>{title}</h4>
        {isEditing ? (
            <textarea 
                className={`w-full border border-${color}-200 rounded p-2 text-sm h-32 focus:ring-1 focus:ring-${color}-500`}
                value={items.join('\n')}
                onChange={e => onChange(e.target.value)}
                placeholder="每行输入一项"
            />
        ) : (
            <ul className={`list-disc pl-5 text-sm text-${color}-800 space-y-1`}>
                {items.length > 0 ? items.map((item, i) => <li key={i}>{item}</li>) : <li className="text-slate-400 italic">无特定建议</li>}
            </ul>
        )}
    </div>
);
