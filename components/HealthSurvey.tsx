
import React, { useState, useEffect, useRef } from 'react';
import { HealthRecord } from '../types';
import { parseHealthDataFromText } from '../services/geminiService';

// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
  onSubmit: (data: HealthRecord) => void;
  initialData?: HealthRecord | null;
  isLoading: boolean;
}

export const HealthSurvey: React.FC<Props> = ({ onSubmit, initialData, isLoading }) => {
  const [mode, setMode] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [data, setData] = useState<HealthRecord | null>(initialData || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'clinical' | 'questionnaire'>('profile');
  const [clinicalSubTab, setClinicalSubTab] = useState<'lab' | 'imaging' | 'optional'>('lab');
  const [surveySubTab, setSurveySubTab] = useState<'history' | 'lifestyle' | 'mental'>('history');

  // Configure PDF Worker with Blob approach to avoid Cross-Origin issues
  useEffect(() => {
    const setupPdfWorker = async () => {
        // Use jsDelivr which is generally faster/reliable in China
        const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        
        // @ts-ignore
        const lib = pdfjsLib.default || pdfjsLib;

        if (!lib.GlobalWorkerOptions) {
             console.warn("PDFJS GlobalWorkerOptions not found");
             return;
        }

        try {
            // Fetch the worker script text
            const response = await fetch(workerUrl);
            if (!response.ok) throw new Error("Failed to fetch worker script");
            const workerScript = await response.text();
            
            // Create a Blob from the script content
            // This bypasses the Cross-Origin Worker restriction because the Blob URL is considered same-origin
            const blob = new Blob([workerScript], { type: "text/javascript" });
            const blobUrl = URL.createObjectURL(blob);
            
            lib.GlobalWorkerOptions.workerSrc = blobUrl;
            console.log("PDF Worker initialized via Blob URL");
        } catch (error) {
            console.warn("PDF Worker Blob setup failed, falling back to direct CDN URL", error);
            // Fallback: Direct URL (Might fail if strict CORS)
            lib.GlobalWorkerOptions.workerSrc = workerUrl;
        }
    };

    setupPdfWorker();
  }, []);

  useEffect(() => {
    setData(initialData || null);
    if (initialData) {
        setMode('review');
    } else {
        setMode('input');
        setRawText('');
    }
    setIsEditing(false);
  }, [initialData]);

  const handleParse = async () => {
    if (!rawText) return;
    setIsParsing(true);
    try {
        const result = await parseHealthDataFromText(rawText);
        setData(result);
        setMode('review');
        setIsEditing(false); 
    } catch (e) {
        alert("AI 解析失败，请检查网络或 Key 配置");
        console.error(e);
    } finally {
        setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsParsing(true);
      try {
          let text = "";
          const fileType = file.name.split('.').pop()?.toLowerCase();

          if (fileType === 'txt') {
              text = await file.text();
          } 
          else if (fileType === 'docx') {
              const arrayBuffer = await file.arrayBuffer();
              const result = await mammoth.extractRawText({ arrayBuffer });
              text = result.value;
              if(result.messages.length > 0) console.log("Word parsing messages:", result.messages);
          }
          else if (fileType === 'xlsx' || fileType === 'xls') {
              const arrayBuffer = await file.arrayBuffer();
              const workbook = XLSX.read(arrayBuffer, { type: 'array' });
              // Iterate all sheets
              workbook.SheetNames.forEach((sheetName: string) => {
                  const sheet = workbook.Sheets[sheetName];
                  text += `--- Sheet: ${sheetName} ---\n`;
                  text += XLSX.utils.sheet_to_csv(sheet);
                  text += "\n\n";
              });
          }
          else if (fileType === 'pdf') {
              const arrayBuffer = await file.arrayBuffer();
              
              // @ts-ignore
              const lib = pdfjsLib.default || pdfjsLib;

              // Load PDF
              const loadingTask = lib.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;
              let fullText = "";
              
              // Iterate pages
              for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  const pageText = textContent.items.map((item: any) => item.str).join(' ');
                  fullText += `--- Page ${i} ---\n${pageText}\n\n`;
              }
              text = fullText;
          }
          else {
              alert("不支持的文件格式。请上传 .txt, .docx, .xlsx, .pdf");
              setIsParsing(false);
              return;
          }

          if (text) {
              setRawText(prev => prev ? prev + "\n\n" + text : text);
          } else {
              alert("未能从文件中提取到有效文本。");
          }

      } catch (error) {
          console.error("File upload error:", error);
          alert("文件解析失败: " + (error instanceof Error ? error.message : "未知错误"));
      } finally {
          setIsParsing(false);
          // Clear input to allow re-uploading same file
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const triggerUpload = () => {
      fileInputRef.current?.click();
  };

  // Helper to calculate BMI automatically
  const calculateBmi = (height?: number, weight?: number) => {
      if (height && weight && height > 0 && weight > 0) {
          // Height is in cm, convert to m
          const h = height / 100;
          // BMI = kg / m^2
          const bmi = weight / (h * h);
          return parseFloat(bmi.toFixed(1));
      }
      return undefined;
  };

  if (mode === 'input') {
    return (
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                智能数据采集
                <span className="text-xs font-normal text-white bg-teal-600 px-2 py-0.5 rounded-full">AI Powered</span>
            </h2>
            <div className="mb-4 text-sm text-slate-500 bg-slate-50 p-4 rounded border border-slate-200">
                <p className="font-bold mb-2">支持录入方式：</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>直接粘贴体检报告或问卷文本</li>
                    <li>上传文件自动提取 (支持 PDF, Word, Excel, TXT)</li>
                </ul>
            </div>
            
            <div className="relative">
                <textarea 
                    className="w-full h-96 p-4 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                    placeholder="请粘贴文本，或点击下方按钮上传文件..."
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                />
                
                {/* Floating Upload Button inside/near Textarea */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".txt,.docx,.doc,.xlsx,.xls,.pdf"
                     />
                     <button 
                        onClick={triggerUpload}
                        disabled={isParsing}
                        className="bg-white text-slate-600 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-slate-50 shadow-sm flex items-center gap-1 transition-colors"
                        title="上传体检报告文件"
                     >
                        {isParsing ? '⏳ 读取中...' : '📂 添加附件 (PDF/Word/Excel)'}
                     </button>
                </div>
            </div>

            <div className="mt-6 flex justify-center pb-8 gap-4">
                <button 
                    onClick={handleParse} 
                    disabled={isParsing || !rawText}
                    className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                    {isParsing ? 'AI 正在解析内容...' : '✨ 开始智能提取'}
                </button>
            </div>
        </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[800px]">
        {/* Main Tabs & Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex gap-2">
                {[
                    {id: 'profile', label: '基本信息'},
                    {id: 'clinical', label: '临床体检数据'},
                    {id: 'questionnaire', label: '健康问卷 (完整版)'}
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                            activeTab === tab.id ? 'bg-teal-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex gap-3 items-center">
                {isEditing ? (
                    <>
                        <button 
                            onClick={() => setIsEditing(false)} 
                            className="bg-teal-600 text-white border border-teal-600 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-teal-700"
                        >
                            💾 保存修改
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="bg-white text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-teal-50 flex items-center gap-1"
                    >
                        ✏️ 修改数据
                    </button>
                )}
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <button onClick={() => {setIsEditing(false); setMode('input');}} className="text-sm text-slate-500 hover:text-teal-600">
                    重新录入
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
            {isEditing && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg mb-4 text-sm flex items-center gap-2 animate-fadeIn">
                    <span>⚠️ 编辑模式开启：请直接点击下方输入框修改内容，修改完成后点击右上角“保存”。</span>
                </div>
            )}
            
            {/* 1. Profile Tab */}
            {activeTab === 'profile' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <Field label="姓名" value={data.profile.name} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, name: v}})} />
                    <Field label="体检编号" value={data.profile.checkupId} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, checkupId: v}})} />
                    <Field label="性别" value={data.profile.gender} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, gender: v}})} />
                    <Field label="年龄" value={data.profile.age} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, age: Number(v)}})} />
                    <Field label="部门" value={data.profile.department} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, department: v}})} />
                    <Field label="电话" value={data.profile.phone} isEditing={isEditing} onChange={v => setData({...data, profile: {...data.profile, phone: v}})} />
                    
                    <div className="col-span-full border-t border-slate-100 pt-4 mt-2">
                        <h4 className="font-bold text-slate-700 mb-4">基础指标</h4>
                        <div className="grid grid-cols-5 gap-4">
                            <Field 
                                label="身高(cm)" 
                                value={data.checkup.basics.height} 
                                isEditing={isEditing} 
                                onChange={v => {
                                    const h = Number(v);
                                    const w = data.checkup.basics.weight;
                                    const bmi = calculateBmi(h, w);
                                    setData({
                                        ...data, 
                                        checkup: {
                                            ...data.checkup, 
                                            basics: {
                                                ...data.checkup.basics, 
                                                height: h,
                                                bmi: bmi !== undefined ? bmi : data.checkup.basics.bmi
                                            }
                                        }
                                    });
                                }} 
                            />
                            <Field 
                                label="体重(kg)" 
                                value={data.checkup.basics.weight} 
                                isEditing={isEditing} 
                                onChange={v => {
                                    const w = Number(v);
                                    const h = data.checkup.basics.height;
                                    const bmi = calculateBmi(h, w);
                                    setData({
                                        ...data, 
                                        checkup: {
                                            ...data.checkup, 
                                            basics: {
                                                ...data.checkup.basics, 
                                                weight: w,
                                                bmi: bmi !== undefined ? bmi : data.checkup.basics.bmi
                                            }
                                        }
                                    });
                                }} 
                            />
                            <Field label="BMI" value={data.checkup.basics.bmi} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, basics: {...data.checkup.basics, bmi: Number(v)}}})} />
                            <Field label="收缩压(mmHg)" value={data.checkup.basics.sbp} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, basics: {...data.checkup.basics, sbp: Number(v)}}})} />
                            <Field label="舒张压(mmHg)" value={data.checkup.basics.dbp} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, basics: {...data.checkup.basics, dbp: Number(v)}}})} />
                            <Field label="腰围(cm)" value={data.checkup.basics.waist} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, basics: {...data.checkup.basics, waist: Number(v)}}})} />
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Clinical Tab (Standard) */}
            {activeTab === 'clinical' && (
                <div>
                    <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'lab', label:'实验室检查'}, {id:'imaging', label:'影像/功能检查'}, {id:'optional', label:'自选项目'}].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setClinicalSubTab(st.id as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                    clinicalSubTab === st.id ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-500'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {clinicalSubTab === 'lab' && (
                        <div className="space-y-6">
                            <Section 
                                title="肝功能" 
                                data={data.checkup.labBasic.liver} 
                                isEditing={isEditing}
                                onItemChange={(k, v) => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, liver: {...data.checkup.labBasic.liver, [k]: v}}}})}
                            />
                            <Section 
                                title="肾功能" 
                                data={data.checkup.labBasic.renal} 
                                isEditing={isEditing}
                                onItemChange={(k, v) => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, renal: {...data.checkup.labBasic.renal, [k]: v}}}})}
                            />
                            <Section 
                                title="血脂" 
                                data={data.checkup.labBasic.lipids} 
                                isEditing={isEditing}
                                onItemChange={(k, v) => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, lipids: {...data.checkup.labBasic.lipids, [k]: v}}}})}
                            />
                            <Section 
                                title="甲功" 
                                data={data.checkup.labBasic.thyroidFunction} 
                                isEditing={isEditing}
                                onItemChange={(k, v) => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, thyroidFunction: {...data.checkup.labBasic.thyroidFunction, [k]: v}}}})}
                            />
                            <div className="grid grid-cols-2 gap-6">
                                <Field label="肌酸激酶" value={data.checkup.labBasic.ck} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, ck: v}}})} />
                                <Field label="空腹血糖" value={data.checkup.labBasic.glucose?.fasting} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, labBasic: {...data.checkup.labBasic, glucose: {...data.checkup.labBasic.glucose, fasting: v}}}})} />
                            </div>
                        </div>
                    )}
                    {/* ... Imaging and Optional tabs ... */}
                    {clinicalSubTab === 'imaging' && (
                        <div className="grid grid-cols-2 gap-6">
                            <Field label="心电图" value={data.checkup.imagingBasic.ecg} fullWidth isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, imagingBasic: {...data.checkup.imagingBasic, ecg: v}}})} />
                            <Field label="甲状腺彩超" value={data.checkup.imagingBasic.ultrasound.thyroid} fullWidth isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, imagingBasic: {...data.checkup.imagingBasic, ultrasound: {...data.checkup.imagingBasic.ultrasound, thyroid: v}}}})} />
                            <Field label="腹部彩超" value={data.checkup.imagingBasic.ultrasound.abdomen} fullWidth isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, imagingBasic: {...data.checkup.imagingBasic, ultrasound: {...data.checkup.imagingBasic.ultrasound, abdomen: v}}}})} />
                            <Field label="乳腺彩超" value={data.checkup.imagingBasic.ultrasound.breast} fullWidth isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, imagingBasic: {...data.checkup.imagingBasic, ultrasound: {...data.checkup.imagingBasic.ultrasound, breast: v}}}})} />
                        </div>
                    )}
                    {clinicalSubTab === 'optional' && (
                         <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="TCT" value={data.checkup.optional.tct} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, optional: {...data.checkup.optional, tct: v}}})} />
                                <Field label="HPV" value={data.checkup.optional.hpv} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, optional: {...data.checkup.optional, hpv: v}}})} />
                                <Field label="骨密度" value={data.checkup.optional.boneDensity} isEditing={isEditing} onChange={v => setData({...data, checkup: {...data.checkup, optional: {...data.checkup.optional, boneDensity: v}}})} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. Questionnaire Tab (Enhanced) */}
            {activeTab === 'questionnaire' && (
                <div>
                     <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'history', label:'病史/家族/女性'}, {id:'lifestyle', label:'生活方式/呼吸'}, {id:'mental', label:'心理/需求'}].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setSurveySubTab(st.id as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                    surveySubTab === st.id ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {surveySubTab === 'history' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h5 className="font-bold text-blue-800 mb-3">既往病史与用药</h5>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {isEditing ? (
                                        <input 
                                            className="w-full border border-blue-300 rounded p-2 text-sm"
                                            value={data.questionnaire.history.diseases.join(', ')}
                                            onChange={e => setData({...data, questionnaire: {...data.questionnaire, history: {...data.questionnaire.history, diseases: e.target.value.split(',').map(s=>s.trim())}}})}
                                        />
                                    ) : (
                                        data.questionnaire.history.diseases.map((d,i) => <span key={i} className="bg-white px-2 py-1 rounded text-sm text-blue-600 border">{d}</span>)
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                     <BoolField label="服降压药" val={data.questionnaire.medication.details.antihypertensive} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, medication: {...data.questionnaire.medication, details: {...data.questionnaire.medication.details, antihypertensive: v}}}})} />
                                     <BoolField label="服降糖药" val={data.questionnaire.medication.details.hypoglycemic} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, medication: {...data.questionnaire.medication, details: {...data.questionnaire.medication.details, hypoglycemic: v}}}})} />
                                     <BoolField label="服降脂药" val={data.questionnaire.medication.details.lipidLowering} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, medication: {...data.questionnaire.medication, details: {...data.questionnaire.medication.details, lipidLowering: v}}}})} />
                                </div>
                            </div>
                            
                            <div className="bg-orange-50 p-4 rounded border border-orange-100">
                                <h5 className="font-bold text-orange-800 mb-3">家族病史 (一级亲属)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <BoolField label="父亲早发冠心病" val={data.questionnaire.familyHistory.fatherCvdEarly} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, fatherCvdEarly: v}}})} />
                                    <BoolField label="母亲早发冠心病" val={data.questionnaire.familyHistory.motherCvdEarly} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, motherCvdEarly: v}}})} />
                                    <BoolField label="糖尿病" val={data.questionnaire.familyHistory.diabetes} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, diabetes: v}}})} />
                                    <BoolField label="高血压" val={data.questionnaire.familyHistory.hypertension} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, hypertension: v}}})} />
                                    <BoolField label="父母脑卒中" val={data.questionnaire.familyHistory.stroke} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, stroke: v}}})} />
                                    <BoolField label="父母髋骨骨折" val={data.questionnaire.familyHistory.parentHipFracture} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, parentHipFracture: v}}})} />
                                    <BoolField label="直系亲属肺癌" val={data.questionnaire.familyHistory.lungCancer} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, lungCancer: v}}})} />
                                    <BoolField label="直系亲属肠癌" val={data.questionnaire.familyHistory.colonCancer} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, familyHistory: {...data.questionnaire.familyHistory, colonCancer: v}}})} />
                                </div>
                            </div>

                            {(data.profile.gender === '女' || isEditing) && (
                                <div className="bg-pink-50 p-4 rounded border border-pink-100">
                                    <h5 className="font-bold text-pink-800 mb-3">女性健康史</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Field label="初潮年龄" value={data.questionnaire.femaleHealth.menarcheAge} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, femaleHealth: {...data.questionnaire.femaleHealth, menarcheAge: Number(v)}}})} />
                                        <Field label="首胎年龄" value={data.questionnaire.femaleHealth.firstBirthAge} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, femaleHealth: {...data.questionnaire.femaleHealth, firstBirthAge: v}}})} />
                                        <Field label="绝经状态" value={data.questionnaire.femaleHealth.menopauseStatus} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, femaleHealth: {...data.questionnaire.femaleHealth, menopauseStatus: v}}})} />
                                        <BoolField label="乳腺活检史" val={data.questionnaire.femaleHealth.breastBiopsy} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, femaleHealth: {...data.questionnaire.femaleHealth, breastBiopsy: v}}})} />
                                        <BoolField label="妊娠糖尿病" val={data.questionnaire.femaleHealth.gdmHistory} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, femaleHealth: {...data.questionnaire.femaleHealth, gdmHistory: v}}})} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {surveySubTab === 'lifestyle' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="border p-4 rounded">
                                    <h5 className="font-bold mb-2 text-sm">吸烟情况</h5>
                                    <Field label="吸烟包年数" value={data.questionnaire.substances.smoking.packYears || '0'} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, substances: {...data.questionnaire.substances, smoking: {...data.questionnaire.substances.smoking, packYears: Number(v)}}}})} />
                                    <Field label="每日支数" value={data.questionnaire.substances.smoking.dailyAmount} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, substances: {...data.questionnaire.substances, smoking: {...data.questionnaire.substances.smoking, dailyAmount: Number(v)}}}})} />
                                    <Field label="吸烟年限" value={data.questionnaire.substances.smoking.years} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, substances: {...data.questionnaire.substances, smoking: {...data.questionnaire.substances.smoking, years: Number(v)}}}})} />
                                </div>
                                <div className="border p-4 rounded">
                                    <h5 className="font-bold mb-2 text-sm">呼吸道症状 (COPD筛查)</h5>
                                    <BoolField label="经常咳嗽" val={data.questionnaire.respiratory.chronicCough} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, respiratory: {...data.questionnaire.respiratory, chronicCough: v}}})} />
                                    <BoolField label="经常咳痰" val={data.questionnaire.respiratory.chronicPhlegm} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, respiratory: {...data.questionnaire.respiratory, chronicPhlegm: v}}})} />
                                    <BoolField label="活动后气短" val={data.questionnaire.respiratory.shortBreath} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, respiratory: {...data.questionnaire.respiratory, shortBreath: v}}})} />
                                </div>
                            </div>
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-teal-700 mb-3 text-sm">膳食与运动</h5>
                                <div className="grid grid-cols-3 gap-4">
                                    <Field label="饮食偏好" value={data.questionnaire.diet.habits.join(', ')} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, diet: {...data.questionnaire.diet, habits: v.split(',').map(s=>s.trim())}}})} />
                                    <Field label="运动频率" value={data.questionnaire.exercise.frequency} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, exercise: {...data.questionnaire.exercise, frequency: v}}})} />
                                    <Field label="睡眠时长" value={data.questionnaire.sleep.hours} isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, sleep: {...data.questionnaire.sleep, hours: v}}})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'mental' && (
                        <div className="space-y-6">
                             <div className="bg-purple-50 p-4 rounded border border-purple-100">
                                <h5 className="font-bold text-purple-800 mb-3">心理量表评分 (PHQ/GAD)</h5>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div>
                                        {isEditing ? (
                                             <input className="w-20 text-center border rounded p-1" type="number" value={data.questionnaire.mentalScales.phq9Score || 0} onChange={e => setData({...data, questionnaire: {...data.questionnaire, mentalScales: {...data.questionnaire.mentalScales, phq9Score: Number(e.target.value)}}})} />
                                        ) : (
                                            <div className="text-2xl font-bold text-purple-700">{data.questionnaire.mentalScales.phq9Score ?? '-'}</div>
                                        )}
                                        <div className="text-xs text-purple-500">PHQ-9 抑郁总分</div>
                                    </div>
                                    <div>
                                        {isEditing ? (
                                             <input className="w-20 text-center border rounded p-1" type="number" value={data.questionnaire.mentalScales.gad7Score || 0} onChange={e => setData({...data, questionnaire: {...data.questionnaire, mentalScales: {...data.questionnaire.mentalScales, gad7Score: Number(e.target.value)}}})} />
                                        ) : (
                                            <div className="text-2xl font-bold text-purple-700">{data.questionnaire.mentalScales.gad7Score ?? '-'}</div>
                                        )}
                                        <div className="text-xs text-purple-500">GAD-7 焦虑总分</div>
                                    </div>
                                    <div>
                                        <div className={`text-xl font-bold ${(data.questionnaire.mentalScales.selfHarmIdea || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {(data.questionnaire.mentalScales.selfHarmIdea || 0) > 0 ? '有' : '无'}
                                        </div>
                                        <div className="text-xs text-slate-500">自伤念头 (危急)</div>
                                    </div>
                                </div>
                            </div>
                            <Field label="主诉压力源" value={data.questionnaire.mental.stressSource?.join(', ')} fullWidth isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, mental: {...data.questionnaire.mental, stressSource: v.split(',').map(s=>s.trim())}}})} />
                            <Field label="最关心的健康问题" value={data.questionnaire.needs.concerns?.join(', ')} fullWidth isEditing={isEditing} onChange={v => setData({...data, questionnaire: {...data.questionnaire, needs: {...data.questionnaire.needs, concerns: v.split(',').map(s=>s.trim())}}})} />
                        </div>
                    )}
                </div>
            )}

        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end shrink-0">
            <button 
                onClick={() => onSubmit(data)}
                disabled={isLoading || isEditing}
                className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50"
            >
                {isLoading ? '正在生成管理方案...' : isEditing ? '请先保存修改' : '确认存档并评估'}
            </button>
        </div>
    </div>
  );
};

// UI Helpers (Updated for Edit Mode)
const Field: React.FC<{label: string, value: any, fullWidth?: boolean, isEditing?: boolean, onChange?: (val: string) => void}> = ({label, value, fullWidth, isEditing, onChange}) => (
    <div className={`bg-slate-50 p-3 rounded border border-slate-200 ${fullWidth ? 'col-span-full' : ''}`}>
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        {isEditing && onChange ? (
            <input 
                type="text" 
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-teal-500"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            />
        ) : (
            <div className="font-medium text-slate-800 text-sm truncate" title={String(value || '')}>
                {value || '-'}
            </div>
        )}
    </div>
);

const BoolField: React.FC<{label: string, val?: boolean, isEditing?: boolean, onChange?: (val: boolean) => void}> = ({label, val, isEditing, onChange}) => (
    <div className={`flex items-center gap-2 ${isEditing ? 'cursor-pointer hover:bg-slate-100 p-1 rounded' : ''}`} 
         onClick={() => isEditing && onChange && onChange(!val)}>
        <div className={`w-3 h-3 rounded-full ${val ? 'bg-red-500' : 'bg-slate-200 border border-slate-300'}`}></div>
        <span className={`${val ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>{label}</span>
    </div>
);

const Section: React.FC<{title: string, data?: {[key:string]: any}, isEditing?: boolean, onItemChange?: (key: string, val: string) => void}> = ({title, data, isEditing, onItemChange}) => {
    if ((!data || Object.keys(data).length === 0) && !isEditing) return null;
    return (
        <div className="border border-slate-200 rounded-lg p-4">
            <h5 className="font-bold text-slate-700 mb-3 text-sm">{title}</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data && Object.entries(data).map(([k, v]) => (
                    (v || isEditing) && <div key={k} className="text-xs">
                        <span className="text-slate-500 block uppercase">{k}</span>
                        {isEditing && onItemChange ? (
                             <input 
                                className="w-full border border-slate-300 rounded px-1 py-0.5 mt-0.5"
                                value={v || ''}
                                onChange={e => onItemChange(k, e.target.value)}
                             />
                        ) : (
                             <span className="font-medium">{String(v)}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
