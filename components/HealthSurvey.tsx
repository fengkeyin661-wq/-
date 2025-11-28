
import React, { useState } from 'react';
import { HealthSurveyData } from '../types';
import { parseHealthDataFromText } from '../services/geminiService';

interface Props {
  onSubmit: (data: HealthSurveyData) => void;
  initialData?: Partial<HealthSurveyData>;
  isLoading: boolean;
}

const DEMO_TEXT = `体检编号   103146  姓 名     张三    
性    别     女     年 龄          83
单    位           郑州大学          部    门       离退休（盛和苑）      体检日期        2022年06月28日       
联系电话         18939554545         

检查综述:*  一般检查 : 血压137/59:基础血压偏低
*  内科 : 既往史高血压
*  眼科 : 双眼人工晶体眼  双眼眼底小瞳下窥不清，建议进一步眼科检查
*  乙肝两对半 : 乙肝两对半全阴
*  类风湿检测3项 : 血沉偏高(47.00(MM/H))
*  肿瘤标志物6项（女） : CA-199(胰腺及胃肠癌抗原)偏高(46.00U/mL)
*  胃泌素17 : 胃泌素17偏高(108.00pg/ml)
*  胸部 : 胸部未见明显异常。（请结合临床）

*  经颅多普勒超声 : 大脑中动脉、基底动脉血流速度、频谱形态正常
*  骨密度 : 骨量减少（中度）
*  口腔科 : 牙楔状缺损  缺齿右下4右下5右下6右下74左下5左下6左下7右上5右上6右上7
*  动脉硬化检测仪 : 左侧外周动脉弹性变差，硬度升高, 主动脉功能有一定减退，但没有发生明显器质性改变。
*  乳腺彩超（女） : 双乳未见明显结节
*  妇科彩超（女） : 绝经后子宫改变
*  泌尿系统彩超（女） : 双肾输尿管膀胱未见明显异常
*  腹部彩超（女） : 肝内囊性回声
*  甲状腺彩超（女） : 甲状腺双侧叶囊性结节

医生建议:
* CA199(胰腺及胃肠癌抗原)偏高: 建议消化科诊治。该检验项目是胰腺癌、胆管癌的敏感标志。
* 胃泌素-17偏高: 建议复查，必要时到消化内科诊治。
* 骨量减少: 合理膳食，保证膳食钙的摄入；增加户外活动。
* 腹部彩超（女） : 肝内囊性回声：定期复查彩超。
* 甲状腺彩超（女） : 甲状腺双侧叶囊性结节：定期复查彩超， 甲状腺专科咨询。
`;

export const HealthSurvey: React.FC<Props> = ({ onSubmit, initialData, isLoading }) => {
  const [mode, setMode] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const [formData, setFormData] = useState<HealthSurveyData>({
    name: initialData?.name || '',
    checkupId: initialData?.checkupId || '',
    gender: initialData?.gender || '女',
    age: initialData?.age || 0,
    department: initialData?.department || '离退休',
    medicalHistory: initialData?.medicalHistory || [],
    abnormalities: initialData?.abnormalities || '',
    checkupAbnormalities: initialData?.checkupAbnormalities || [],
    medications: initialData?.medications || '',
    surgeries: initialData?.surgeries || '无',
    diet: initialData?.diet || [],
    exerciseFrequency: initialData?.exerciseFrequency || '',
    smokingStatus: initialData?.smokingStatus || '从不吸烟',
    drinkingStatus: initialData?.drinkingStatus || '从不饮酒',
    sleepHours: initialData?.sleepHours || 7,
    stressLevel: initialData?.stressLevel || '',
    mainConcerns: initialData?.mainConcerns || [],
  });

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
        const parsedData = await parseHealthDataFromText(rawText);
        setFormData(prev => ({
            ...prev,
            ...parsedData,
            // Ensure arrays are arrays in case AI returns strings
            medicalHistory: Array.isArray(parsedData.medicalHistory) ? parsedData.medicalHistory : [],
            diet: Array.isArray(parsedData.diet) ? parsedData.diet : [],
            mainConcerns: Array.isArray(parsedData.mainConcerns) ? parsedData.mainConcerns : [],
            checkupAbnormalities: Array.isArray(parsedData.checkupAbnormalities) ? parsedData.checkupAbnormalities : []
        }));
        setMode('review');
    } catch (e) {
        console.error(e);
        alert(`AI 解析失败: ${e instanceof Error ? e.message : '未知错误'}。请检查网络连接或手动输入。`);
    } finally {
        setIsParsing(false);
    }
  };

  const handleChange = (field: keyof HealthSurveyData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Helper to remove an item from checkupAbnormalities
  const removeAbnormality = (index: number) => {
      const newList = [...formData.checkupAbnormalities];
      newList.splice(index, 1);
      handleChange('checkupAbnormalities', newList);
  };

  const [activeSection, setActiveSection] = useState(0);
  const sections = ['基本信息', '体检异常汇总', '生活方式'];

  if (mode === 'input') {
      return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden p-8 animate-fadeIn">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    🤖
                </div>
                <h2 className="text-2xl font-bold text-slate-800">智能健康建档</h2>
                <p className="text-slate-500 mt-2">支持粘贴复杂的医院体检报告文本，AI 将自动提取异常指标。</p>
            </div>

            <div className="mb-6 relative">
                <textarea
                    className="w-full h-96 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none text-slate-700 leading-relaxed font-mono text-xs bg-slate-50"
                    placeholder="在此粘贴文本..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                ></textarea>
                <div className="absolute bottom-4 right-4 flex gap-2">
                    <button 
                        onClick={() => setRawText(DEMO_TEXT)}
                        className="px-3 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                    >
                        填入示例数据 (张三 - 郑大体检)
                    </button>
                    <button 
                        onClick={() => setRawText('')}
                        className="px-3 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                    >
                        清空
                    </button>
                </div>
            </div>

            <div className="flex justify-center gap-4">
                <button
                    onClick={() => setMode('review')} // Skip to manual
                    className="px-6 py-3 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                    跳过，手动录入
                </button>
                <button
                    onClick={handleParse}
                    disabled={isParsing || !rawText}
                    className="px-8 py-3 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 disabled:opacity-70 flex items-center gap-2"
                >
                    {isParsing ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            AI 深度解析中...
                        </>
                    ) : (
                        '开始智能识别'
                    )}
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-fadeIn">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setMode('input')}
                className="text-slate-400 hover:text-teal-600 flex items-center gap-1 text-sm"
            >
                ← 返回文本输入
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <div className="flex space-x-2">
                {sections.map((sec, idx) => (
                    <button 
                        key={sec}
                        onClick={() => setActiveSection(idx)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            activeSection === idx ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                    >
                        {idx + 1}. {sec}
                    </button>
                ))}
            </div>
        </div>
        <div className="text-sm text-teal-600 font-medium">
            ✨ AI 已提取数据，请校对
        </div>
      </div>

      <div className="p-8">
        {activeSection === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">姓名 *</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">体检编号 *</label>
              <input 
                type="text" 
                value={formData.checkupId}
                onChange={(e) => handleChange('checkupId', e.target.value)}
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">性别</label>
              <select 
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">年龄</label>
              <input 
                type="number" 
                value={formData.age}
                onChange={(e) => handleChange('age', Number(e.target.value))}
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">所在部门</label>
               <input 
                type="text"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
              />
            </div>
            <div className="col-span-1 md:col-span-2">
                 <label className="block text-sm font-medium text-slate-700 mb-2">既往病史 (多选)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                         {formData.medicalHistory.map((disease, idx) => (
                             <span key={idx} className="px-3 py-1 rounded-md text-sm border bg-blue-100 border-blue-500 text-blue-700 flex items-center gap-1">
                                {disease}
                                <button onClick={() => handleChange('medicalHistory', formData.medicalHistory.filter(h => h !== disease))} className="hover:text-blue-900">×</button>
                             </span>
                         ))}
                    </div>
                    <input 
                        type="text"
                        placeholder="输入其他病史后回车添加"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !formData.medicalHistory.includes(val)) {
                                    handleChange('medicalHistory', [...formData.medicalHistory, val]);
                                    e.currentTarget.value = '';
                                }
                            }
                        }}
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                    />
            </div>
          </div>
        )}

        {activeSection === 1 && (
             <div className="space-y-6 animate-fadeIn">
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                     <h3 className="font-bold text-red-700 mb-4 flex items-center gap-2">
                        <span>⚠️</span> AI 自动提取的异常项清单
                     </h3>
                     {formData.checkupAbnormalities.length > 0 ? (
                         <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-left">
                                <thead className="bg-red-100 text-red-900 font-bold">
                                    <tr>
                                        <th className="px-4 py-2 rounded-tl-lg">检查项目</th>
                                        <th className="px-4 py-2">结果/数值</th>
                                        <th className="px-4 py-2">临床提示/建议</th>
                                        <th className="px-4 py-2 rounded-tr-lg w-16">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-red-200">
                                    {formData.checkupAbnormalities.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-red-50/50">
                                            <td className="px-4 py-2 font-medium">{item.item}</td>
                                            <td className="px-4 py-2 text-red-600 font-bold">{item.result}</td>
                                            <td className="px-4 py-2 text-slate-600">{item.suggestion}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button 
                                                    onClick={() => removeAbnormality(idx)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                     ) : (
                         <p className="text-slate-500 italic">未检测到明显的结构化异常数据，请手动补充。</p>
                     )}
                     
                     <div className="mt-4 flex gap-2">
                        <button className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50 transition-colors">
                            + 手动添加异常项
                        </button>
                     </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">体检综述 (文本摘要)</label>
                    <textarea 
                        rows={5}
                        value={formData.abnormalities}
                        onChange={(e) => handleChange('abnormalities', e.target.value)}
                        placeholder="AI 生成的总体摘要..."
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none text-sm" 
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">当前用药情况</label>
                    <textarea 
                        rows={3}
                        value={formData.medications}
                        onChange={(e) => handleChange('medications', e.target.value)}
                        placeholder="例如：苯磺酸氨氯地平 5mg 每日一次..."
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                    />
                </div>
             </div>
        )}

        {activeSection === 2 && (
             <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">运动频率</label>
                        <input 
                            type="text"
                            value={formData.exerciseFrequency}
                            onChange={(e) => handleChange('exerciseFrequency', e.target.value)}
                            className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">平均睡眠 (小时/晚)</label>
                        <input 
                            type="number"
                            step="0.5"
                            value={formData.sleepHours}
                            onChange={(e) => handleChange('sleepHours', Number(e.target.value))}
                            className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">吸烟情况</label>
                        <select 
                            value={formData.smokingStatus}
                            onChange={(e) => handleChange('smokingStatus', e.target.value)}
                            className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                        >
                            <option>从不吸烟</option>
                            <option>已戒烟</option>
                            <option>目前吸烟</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">饮酒情况</label>
                        <input 
                            type="text"
                            value={formData.drinkingStatus}
                            onChange={(e) => handleChange('drinkingStatus', e.target.value)}
                            className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">饮食习惯 (多选)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {formData.diet.map((habit, idx) => (
                             <span key={idx} className="px-3 py-1 rounded-md text-sm border bg-amber-100 border-amber-500 text-amber-700 flex items-center gap-1">
                                {habit}
                                <button onClick={() => handleChange('diet', formData.diet.filter(h => h !== habit))} className="hover:text-amber-900">×</button>
                             </span>
                         ))}
                    </div>
                     <input 
                        type="text"
                        placeholder="输入其他饮食习惯后回车添加"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !formData.diet.includes(val)) {
                                    handleChange('diet', [...formData.diet, val]);
                                    e.currentTarget.value = '';
                                }
                            }
                        }}
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">自我压力评估</label>
                    <input 
                        type="text"
                        value={formData.stressLevel}
                        onChange={(e) => handleChange('stressLevel', e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-teal-500 outline-none" 
                    />
                </div>
             </div>
        )}
      </div>

      <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-between">
            <button 
                onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                disabled={activeSection === 0}
                className="px-6 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
                上一步
            </button>
            
            {activeSection < sections.length - 1 ? (
                 <button 
                    onClick={() => setActiveSection(activeSection + 1)}
                    className="px-6 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
                >
                    下一步
                </button>
            ) : (
                <button 
                    onClick={() => onSubmit(formData)}
                    disabled={isLoading}
                    className="px-6 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 disabled:opacity-70 flex items-center gap-2"
                >
                    {isLoading ? '生成风险评估...' : '提交档案'}
                </button>
            )}
      </div>
    </div>
  );
};
