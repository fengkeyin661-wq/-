
import React, { useState, useEffect } from 'react';
import { fetchPatientArchive, HealthArchive } from '../services/dataService';
import { useToast } from './Toast';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Types for Mobile View ---
type MobileTab = 'home' | 'record' | 'tasks' | 'profile';

export const MobilePatientApp: React.FC = () => {
    const [user, setUser] = useState<HealthArchive | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<MobileTab>('home');
    const toast = useToast();

    // Login Form State
    const [loginName, setLoginName] = useState('');
    const [loginPhone, setLoginPhone] = useState('');

    // Check Local Storage for auto-login
    useEffect(() => {
        const cachedUser = localStorage.getItem('mobile_patient_data');
        if (cachedUser) {
            setUser(JSON.parse(cachedUser));
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const data = await fetchPatientArchive(loginName, loginPhone);
            if (data) {
                setUser(data);
                localStorage.setItem('mobile_patient_data', JSON.stringify(data));
                toast.success('登录成功');
            } else {
                toast.error('未找到档案，请检查姓名和电话');
            }
        } catch (err) {
            toast.error('登录失败，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('mobile_patient_data');
        setUser(null);
    };

    // --- RENDER LOGIN SCREEN ---
    if (!user) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 animate-fadeIn">
                <div className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-xl shadow-teal-200">
                    Z
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">健康管理中心</h1>
                <p className="text-slate-500 mb-8 text-sm">郑州大学医院 · 您的掌上健康管家</p>

                <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">姓名</label>
                        <input 
                            type="text" 
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold text-slate-800"
                            placeholder="请输入体检姓名"
                            value={loginName}
                            onChange={e => setLoginName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">手机号</label>
                        <input 
                            type="tel" 
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold text-slate-800"
                            placeholder="预留手机号 (后4位或完整)"
                            value={loginPhone}
                            onChange={e => setLoginPhone(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-200 active:scale-95 transition-all mt-4 disabled:opacity-70"
                    >
                        {isLoading ? '正在查找档案...' : '立即进入'}
                    </button>
                    
                    <p className="text-center text-xs text-slate-400 mt-6">
                        未找到档案？请联系体检中心 0371-67739261
                    </p>
                </form>
            </div>
        );
    }

    // --- RENDER MAIN APP ---
    return (
        <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto shadow-2xl relative overflow-hidden">
            {activeTab === 'home' && <HomeView user={user} />}
            {activeTab === 'record' && <RecordView user={user} />}
            {activeTab === 'tasks' && <TasksView user={user} />}
            {activeTab === 'profile' && <ProfileView user={user} onLogout={handleLogout} />}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-end z-50 max-w-md mx-auto shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
                <NavIcon icon="🏠" label="首页" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                <NavIcon icon="📋" label="档案" isActive={activeTab === 'record'} onClick={() => setActiveTab('record')} />
                <div className="relative -top-5">
                    <button 
                        onClick={() => setActiveTab('tasks')}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform ${activeTab === 'tasks' ? 'bg-teal-600 text-white scale-110 ring-4 ring-teal-100' : 'bg-slate-800 text-white'}`}
                    >
                        ✨
                    </button>
                </div>
                <NavIcon icon="💊" label="计划" isActive={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
                <NavIcon icon="👤" label="我的" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            </div>
        </div>
    );
};

// --- Sub-Views ---

const HomeView: React.FC<{user: HealthArchive}> = ({ user }) => {
    const riskLevel = user.risk_level;
    const lastFollowUp = user.follow_ups && user.follow_ups.length > 0 
        ? user.follow_ups[user.follow_ups.length - 1] 
        : null;

    // Prepare Chart Data
    const chartData = (user.follow_ups || []).slice(-5).map(f => ({
        date: f.date.split('-').slice(1).join('/'),
        sbp: f.indicators.sbp,
        dbp: f.indicators.dbp
    }));

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="bg-teal-600 text-white p-6 pt-10 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                        <p className="text-teal-100 text-xs mb-1">早安,</p>
                        <h1 className="text-2xl font-bold">{user.name}</h1>
                    </div>
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        🔔
                    </div>
                </div>

                {/* Risk Card */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex items-center justify-between relative z-10">
                    <div>
                        <div className="text-xs text-teal-50 mb-1">当前健康风险等级</div>
                        <div className="text-3xl font-bold flex items-center gap-2">
                            {riskLevel === 'RED' ? '高风险' : riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                            <span className={`w-3 h-3 rounded-full border-2 border-white ${
                                riskLevel === 'RED' ? 'bg-red-500' : riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}></span>
                        </div>
                    </div>
                    <div className="text-4xl opacity-80">
                         {riskLevel === 'RED' ? '🌩️' : riskLevel === 'YELLOW' ? '🌥️' : '☀️'}
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-6 -mt-4 relative z-20">
                {/* Doctor Message */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-3 border-b border-slate-50 pb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-lg">👨‍⚕️</div>
                        <span className="font-bold text-slate-800 text-sm">医生最新寄语</span>
                        <span className="text-[10px] text-slate-400 ml-auto bg-slate-50 px-2 py-1 rounded">
                            {lastFollowUp ? lastFollowUp.date : user.created_at.split('T')[0]}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed italic">
                        "{lastFollowUp?.assessment.doctorMessage || user.assessment_data.summary.substring(0, 60) + '...'}"
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center gap-2 active:scale-95 transition-transform">
                        <span className="text-2xl">🩸</span>
                        <span className="font-bold text-blue-800 text-sm">血压/血糖记录</span>
                    </button>
                    <button className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center gap-2 active:scale-95 transition-transform">
                        <span className="text-2xl">💊</span>
                        <span className="font-bold text-orange-800 text-sm">服药打卡</span>
                    </button>
                </div>

                {/* Trend Chart */}
                {chartData.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 text-sm">近期血压趋势</h3>
                        <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="date" hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="sbp" stroke="#ef4444" strokeWidth={3} dot={false} />
                                <Line type="monotone" dataKey="dbp" stroke="#f97316" strokeWidth={3} dot={false} />
                            </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const RecordView: React.FC<{user: HealthArchive}> = ({ user }) => {
    return (
        <div className="p-6 pt-10 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">我的健康档案</h2>
            
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-2">基本信息</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">部门:</span> <span className="font-bold text-slate-800">{user.department}</span>
                        </div>
                        <div>
                            <span className="text-slate-500">年龄:</span> <span className="font-bold text-slate-800">{user.age}岁</span>
                        </div>
                        <div>
                            <span className="text-slate-500">BMI:</span> <span className="font-bold text-slate-800">{user.health_record.checkup.basics.bmi}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-3">六大系统画像状态</div>
                    <div className="grid grid-cols-2 gap-3">
                        {user.risk_analysis?.portraits.map((p, i) => (
                            <div key={i} className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                                p.status === 'High' ? 'bg-red-50 border-red-100 text-red-800' :
                                p.status === 'Medium' ? 'bg-orange-50 border-orange-100 text-orange-800' :
                                'bg-slate-50 border-slate-100 text-slate-600'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <span>{p.icon}</span>
                                    <span className="font-bold">{p.systemName}</span>
                                </div>
                                {p.status !== 'Normal' && <span className="w-2 h-2 rounded-full bg-current"></span>}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-3">主要异常项</div>
                    {user.health_record.checkup.abnormalities.length > 0 ? (
                        <ul className="space-y-2">
                            {user.health_record.checkup.abnormalities.map((ab, i) => (
                                <li key={i} className="text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                    <span className="font-bold text-slate-700 block">{ab.item}</span>
                                    <span className="text-xs text-orange-600">{ab.result}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center text-slate-400 py-4 text-sm">未发现明显异常</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TasksView: React.FC<{user: HealthArchive}> = ({ user }) => {
    return (
        <div className="p-6 pt-10 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">今日健康任务</h2>
            <p className="text-slate-500 text-sm mb-6">完成打卡，养成好习惯</p>

            <div className="space-y-3">
                {user.assessment_data.managementPlan.exercise.slice(0, 3).map((task, i) => (
                    <TaskItem key={i} title={task} type="exercise" />
                ))}
                 {user.assessment_data.managementPlan.dietary.slice(0, 2).map((task, i) => (
                    <TaskItem key={`d_${i}`} title={task} type="diet" />
                ))}
            </div>
        </div>
    );
};

const TaskItem = ({ title, type }: { title: string, type: 'exercise'|'diet' }) => {
    const [checked, setChecked] = useState(false);
    return (
        <div 
            onClick={() => setChecked(!checked)}
            className={`p-4 rounded-xl border flex items-center gap-4 transition-all active:scale-95 cursor-pointer ${
                checked ? 'bg-teal-50 border-teal-200' : 'bg-white border-slate-100'
            }`}
        >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                checked ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300'
            }`}>
                {checked && '✓'}
            </div>
            <div className="flex-1">
                <div className={`text-sm font-bold ${checked ? 'text-teal-800 line-through opacity-50' : 'text-slate-800'}`}>
                    {title}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">
                    {type === 'exercise' ? '🏃 运动' : '🥗 饮食'}
                </div>
            </div>
        </div>
    );
};

const ProfileView: React.FC<{user: HealthArchive, onLogout: () => void}> = ({ user, onLogout }) => {
    return (
        <div className="p-6 pt-10 animate-fadeIn">
             <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-lg mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl">
                        {user.gender === '女' ? '👩' : '👨'}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{user.name}</h2>
                        <p className="text-slate-300 text-xs font-mono">{user.phone}</p>
                    </div>
                </div>
             </div>

             <div className="space-y-2">
                 <button className="w-full bg-white p-4 rounded-xl border border-slate-100 text-left font-bold text-slate-700 flex justify-between items-center">
                     <span>📅 我的预约</span>
                     <span className="text-slate-400 text-xl">›</span>
                 </button>
                 <button className="w-full bg-white p-4 rounded-xl border border-slate-100 text-left font-bold text-slate-700 flex justify-between items-center">
                     <span>⚙️ 设置</span>
                     <span className="text-slate-400 text-xl">›</span>
                 </button>
                 <button className="w-full bg-white p-4 rounded-xl border border-slate-100 text-left font-bold text-slate-700 flex justify-between items-center">
                     <span>❓ 帮助中心</span>
                     <span className="text-slate-400 text-xl">›</span>
                 </button>
             </div>

             <button 
                onClick={onLogout}
                className="w-full mt-10 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors"
             >
                 退出登录
             </button>
        </div>
    );
};

const NavIcon = ({ icon, label, isActive, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-teal-600' : 'text-slate-400'}`}
    >
        <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{icon}</span>
        <span className="text-[10px] font-bold">{label}</span>
    </button>
);
