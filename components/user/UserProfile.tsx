
import React, { useState } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  onUpdateRecord: (updatedData: any) => void;
}

export const UserProfile: React.FC<Props> = ({ record, assessment, onUpdateRecord }) => {
    // Mock Trend Data
    const trendData = [
        { date: '1月', val: 135 }, { date: '2月', val: 130 }, { date: '3月', val: 128 }, { date: '4月', val: 125 }
    ];

    return (
        <div className="bg-slate-50 min-h-full pb-20">
            {/* Header / ID Card */}
            <div className="bg-teal-700 text-white p-6 pb-16 relative">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl border-2 border-white/30 backdrop-blur-sm">
                        {record.profile.gender === '女' ? '👩' : '👨'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{record.profile.name}</h1>
                        <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
                            <span className="bg-white/20 px-2 py-0.5 rounded">{record.profile.department}</span>
                            <span>{record.profile.age}岁</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-6 right-6">
                    <button className="text-white/80 hover:text-white text-xl">⚙️</button>
                </div>
            </div>

            <div className="px-4 -mt-10 space-y-6">
                
                {/* 1. Health Status Card */}
                <div className="bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">健康状态</h3>
                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                            assessment?.riskLevel === 'RED' ? 'bg-red-100 text-red-700' : 
                            assessment?.riskLevel === 'YELLOW' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                            {assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                        </span>
                    </div>
                    
                    {/* Core Indicators Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">BMI</div>
                            <div className="font-bold text-slate-700">{record.checkup.basics.bmi || '-'}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">血压</div>
                            <div className="font-bold text-slate-700">{record.checkup.basics.sbp}/{record.checkup.basics.dbp}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">血糖</div>
                            <div className="font-bold text-slate-700">{record.checkup.labBasic.glucose?.fasting || '-'}</div>
                        </div>
                    </div>

                    {/* Mini Trend */}
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <XAxis dataKey="date" hide />
                                <Tooltip contentStyle={{fontSize:'10px'}} />
                                <Line type="monotone" dataKey="val" stroke="#0d9488" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-center text-slate-400 mt-1">近4个月收缩压变化</p>
                </div>

                {/* 2. Family Doctor */}
                <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">👨‍⚕️</div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-sm">我的家庭医生</h3>
                        <p className="text-xs text-slate-500 mt-0.5">张医生 · 全科团队</p>
                    </div>
                    <button className="text-xs font-bold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full">联系</button>
                </div>

                {/* 3. My Plans & Reminders */}
                <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 ml-1">我的管理</h3>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center cursor-pointer active:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">💊</span>
                            <div>
                                <div className="font-bold text-sm text-slate-800">用药提醒</div>
                                <div className="text-xs text-slate-400">每日 08:00, 20:00</div>
                            </div>
                        </div>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center cursor-pointer active:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">🥗</span>
                            <div>
                                <div className="font-bold text-sm text-slate-800">饮食与运动方案</div>
                                <div className="text-xs text-slate-400">查看我的定制计划</div>
                            </div>
                        </div>
                        <span className="text-slate-300">›</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center cursor-pointer active:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📂</span>
                            <div>
                                <div className="font-bold text-sm text-slate-800">健康档案</div>
                                <div className="text-xs text-slate-400">体检报告、历史记录</div>
                            </div>
                        </div>
                        <span className="text-slate-300">›</span>
                    </div>
                </div>
                
                <div className="h-6"></div>
            </div>
        </div>
    );
};
