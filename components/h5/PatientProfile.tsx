
import React from 'react';
import { HealthArchive } from '../../services/dataService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const PatientProfile: React.FC<{ archive: HealthArchive, onLogout: () => void }> = ({ archive, onLogout }) => {
    // Generate mock trend data if follow-ups are sparse
    // In a real app, this would come from `archive.follow_ups`
    const historyData = archive.follow_ups && archive.follow_ups.length > 0 
        ? archive.follow_ups.map(f => ({
            date: f.date.substring(5), // MM-DD
            weight: f.indicators.weight || null,
            sbp: f.indicators.sbp || null
          })).slice(-5)
        : [
            { date: '初始', weight: archive.health_record.checkup.basics.weight || 0, sbp: archive.health_record.checkup.basics.sbp || 0 },
            { date: '预测', weight: (archive.health_record.checkup.basics.weight || 0) - 1, sbp: (archive.health_record.checkup.basics.sbp || 0) - 5 }
          ];

    return (
        <div className="bg-slate-50 min-h-full pb-24 animate-fadeIn">
            {/* Header */}
            <div className="bg-white p-6 pb-8 rounded-b-[2.5rem] shadow-sm mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
                
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl border-2 border-white shadow-md">
                         {archive.gender === '女' ? '👩🏻' : '👨🏻'}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{archive.name}</h2>
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{archive.department}</span>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mt-6">
                    <InfoItem label="年龄" value={`${archive.age}岁`} />
                    <InfoItem label="血型" value="未知" />
                    <InfoItem label="档案号" value={archive.checkup_id} />
                </div>
            </div>

            <div className="px-5 space-y-5">
                {/* Trend Charts */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span>📉</span> 健康趋势
                        </h3>
                        <span className="text-[10px] text-slate-400">近5次记录</span>
                    </div>
                    
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData}>
                                <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#cbd5e1" axisLine={false} tickLine={false} dy={10} />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                                    labelStyle={{fontSize: '10px', color: '#94a3b8', marginBottom: '4px'}}
                                />
                                <Line type="monotone" dataKey="weight" name="体重" stroke="#0d9488" strokeWidth={3} dot={{r:3, fill: '#0d9488', strokeWidth: 0}} activeDot={{r:5}} />
                                <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#f43f5e" strokeWidth={3} dot={{r:3, fill: '#f43f5e', strokeWidth: 0}} activeDot={{r:5}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-teal-700"><span className="w-2 h-2 rounded-full bg-teal-600"></span>体重 (kg)</span>
                        <span className="flex items-center gap-1.5 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500"></span>收缩压 (mmHg)</span>
                    </div>
                </div>

                {/* Family Accounts (Mock) */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
                    <h3 className="font-bold text-sm mb-2 opacity-90">👨‍👩‍👧‍👦 家庭成员健康</h3>
                    <p className="text-xs opacity-80 mb-4">关联父母或子女档案，全家健康一手掌握</p>
                    <button className="bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        + 添加成员
                    </button>
                </div>

                {/* Settings Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <ActionItem icon="🔒" label="修改密码" />
                    <ActionItem icon="🔔" label="消息通知设置" />
                    <ActionItem icon="📱" label="关于我们" />
                    <button 
                        onClick={onLogout}
                        className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold"
                    >
                        <span className="text-lg">🚪</span> 退出登录
                    </button>
                </div>
                
                <div className="text-center text-[10px] text-slate-300 pb-4">
                    v3.0.1 Build 20240520
                </div>
            </div>
        </div>
    );
};

const InfoItem = ({ label, value }: any) => (
    <div className="text-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">{label}</div>
        <div className="font-bold text-slate-700 text-xs truncate">{value}</div>
    </div>
);

const ActionItem = ({ icon, label }: any) => (
    <button className="w-full p-4 flex items-center gap-4 text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
        <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
        <span className="text-sm font-medium flex-1 text-left">{label}</span>
        <span className="text-slate-300">›</span>
    </button>
);
