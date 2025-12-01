
import React, { useState } from 'react';
import { verifyPatientLogin, HealthArchive } from '../../services/dataService';
import { useToast } from '../Toast';

interface Props {
    onLoginSuccess: (archive: HealthArchive) => void;
    onBack: () => void;
}

export const PatientLogin: React.FC<Props> = ({ onLoginSuccess, onBack }) => {
    const [checkupId, setCheckupId] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkupId || !name) {
            toast.error("请输入完整信息");
            return;
        }
        setLoading(true);
        try {
            const result = await verifyPatientLogin(checkupId, name);
            if (result) {
                toast.success("欢迎回来！");
                onLoginSuccess(result);
            } else {
                toast.error("未找到档案，请检查编号和姓名是否匹配");
            }
        } catch (e) {
            toast.error("登录失败，网络异常");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-fadeIn">
            <div className="w-full max-w-sm">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg shadow-teal-200">
                        Z
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">郑州大学医院</h1>
                    <p className="text-slate-500 mt-1">个人健康档案查询</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">体检编号 / 工号</label>
                            <input 
                                type="text" 
                                value={checkupId}
                                onChange={e => setCheckupId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                placeholder="请输入..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">真实姓名</label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                placeholder="请输入..."
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-95 transition-all mt-4 disabled:opacity-70"
                        >
                            {loading ? '查询中...' : '立即查询'}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <button onClick={onBack} className="text-slate-400 text-sm hover:text-slate-600">
                        返回首页
                    </button>
                </div>
            </div>
            
            <div className="fixed bottom-6 text-center w-full">
                <p className="text-[10px] text-slate-300">© Health Management Center</p>
            </div>
        </div>
    );
};
