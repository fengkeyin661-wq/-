
import React, { useState } from 'react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (role: 'admin' | 'home') => void;
}

export const LoginModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [authStep, setAuthStep] = useState<'login' | 'verify'>('login');
    
    // Login Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Verification Form State
    const [email, setEmail] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [sentCode, setSentCode] = useState('');
    const [verifyMsg, setVerifyMsg] = useState('');

    // Credentials
    const ADMIN_USER = "zzdxyy";
    const ADMIN_PASS = "xyy67739261#";
    
    const HOME_USER = "home";
    const HOME_PASS = "8888";

    const ADMIN_EMAIL = "xiaoyin4567@126.com";

    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            setLoginError('');
            onLoginSuccess('admin');
            onClose();
        } else if (username === HOME_USER && password === HOME_PASS) {
            setLoginError('');
            onLoginSuccess('home');
            onClose();
        } else {
            setLoginError('账号或密码错误');
        }
    };

    const handleSendCode = () => {
        if (email !== ADMIN_EMAIL) {
            setVerifyMsg('错误：未授权的管理员邮箱');
            return;
        }
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setSentCode(code);
        alert(`【系统模拟】验证码已发送至 ${email}：${code}`);
        setVerifyMsg('验证码已发送，请查收');
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        if (verifyCode === sentCode && sentCode !== '') {
            alert('验证通过，正在登录...');
            setAuthStep('login'); 
            onLoginSuccess('admin'); // Verify logic defaults to main admin
            onClose();
        } else {
            setVerifyMsg('验证码错误');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
            <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 w-full max-w-md relative animate-scaleIn">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                    ×
                </button>

                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">Z</div>
                    <h2 className="text-xl font-bold text-slate-800">管理后台登录</h2>
                    <p className="text-slate-500 text-xs mt-1">郑州大学医院健康管理中心</p>
                </div>

                {authStep === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">管理员账号</label>
                            <input 
                                type="text" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                                placeholder="输入账号 (admin / home)"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">密码</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                                placeholder="请输入密码"
                            />
                        </div>
                        {loginError && <p className="text-red-500 text-xs text-center font-bold">{loginError}</p>}
                        
                        <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg hover:bg-slate-700 transition-colors shadow-lg text-sm">
                            登录系统
                        </button>
                        
                        <div className="text-center">
                            <button type="button" onClick={() => setAuthStep('verify')} className="text-xs text-teal-600 hover:underline">
                                忘记密码 / 邮箱验证登录
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} className="space-y-5">
                        <div className="bg-blue-50 p-2.5 rounded text-xs text-blue-700 mb-2 leading-relaxed">
                            请输入系统绑定的管理员邮箱进行验证。
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">验证邮箱</label>
                            <div className="flex gap-2">
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                                    placeholder="xiaoyin...@126.com"
                                />
                                <button 
                                    type="button" 
                                    onClick={handleSendCode}
                                    className="bg-teal-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-teal-700 whitespace-nowrap"
                                >
                                    获取验证码
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">验证码</label>
                            <input 
                                type="text" 
                                value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                                placeholder="查看邮件输入验证码"
                            />
                        </div>
                        {verifyMsg && <p className={`text-xs text-center font-bold ${verifyMsg.includes('错误') ? 'text-red-500' : 'text-green-600'}`}>{verifyMsg}</p>}

                        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2.5 rounded-lg hover:bg-teal-700 transition-colors shadow-lg text-sm">
                            验证并登录
                        </button>

                        <div className="text-center">
                            <button type="button" onClick={() => setAuthStep('login')} className="text-xs text-slate-500 hover:text-slate-800">
                                &lt; 返回账号登录
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
