
import React, { useState } from 'react';

export const UserMedical: React.FC = () => {
    const [subTab, setSubTab] = useState<'consult' | 'booking' | 'wiki' | 'pharmacy'>('booking');
    const [drugSearch, setDrugSearch] = useState('');

    const depts = ['内科', '外科', '体检科', '口腔科', '眼科', '耳鼻喉科', '中医科', '康复科'];
    
    const drugs = [
        { name: '阿司匹林肠溶片', stock: '充足', spec: '100mg*30片' },
        { name: '二甲双胍片', stock: '少量', spec: '0.5g*20片' },
        { name: '布洛芬缓释胶囊', stock: '缺货', spec: '0.3g*24粒' },
        { name: '连花清瘟胶囊', stock: '充足', spec: '0.35g*24粒' },
    ];

    const filteredDrugs = drugs.filter(d => d.name.includes(drugSearch));

    return (
        <div className="p-4 bg-slate-50 min-h-full space-y-4 animate-fadeIn">
             <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                {[{id:'booking', label:'预约挂号'}, {id:'consult', label:'在线咨询'}, {id:'wiki', label:'医学科普'}, {id:'pharmacy', label:'药品查询'}].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setSubTab(t.id as any)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            subTab === t.id ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {subTab === 'booking' && (
                <div className="grid grid-cols-2 gap-3">
                    {depts.map((d, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center hover:border-blue-400 transition-colors cursor-pointer">
                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-xl mb-2">
                                {i < 2 ? '🩺' : i === 3 ? '🦷' : i === 6 ? '🌿' : '🏥'}
                            </div>
                            <span className="font-bold text-slate-700">{d}</span>
                            <span className="text-[10px] text-green-500 mt-1">● 可预约</span>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'consult' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
                    <div className="text-4xl mb-4">👩‍⚕️</div>
                    <h3 className="text-lg font-bold text-slate-800">在线医生咨询</h3>
                    <p className="text-xs text-slate-500 mt-2 mb-6">工作时间：08:00 - 17:30<br/>平均回复时间：5分钟</p>
                    <button className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg active:scale-95">发起图文咨询</button>
                </div>
            )}

            {subTab === 'wiki' && (
                <div className="space-y-3">
                    {['高血压日常护理', '糖尿病饮食禁忌', '季节性过敏防治', '腰椎间盘突出康复操'].map((title, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                            <span className="font-bold text-slate-700 text-sm">{title}</span>
                            <span className="text-slate-300">›</span>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'pharmacy' && (
                <div className="space-y-4">
                    <input 
                        className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500"
                        placeholder="输入药品名称查询库存..."
                        value={drugSearch}
                        onChange={e => setDrugSearch(e.target.value)}
                    />
                    <div className="space-y-2">
                        {filteredDrugs.map((d, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-800">{d.name}</div>
                                    <div className="text-xs text-slate-500">{d.spec}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                        d.stock === '充足' ? 'bg-green-100 text-green-700' : 
                                        d.stock === '少量' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                    }`}>{d.stock}</span>
                                    {d.stock !== '缺货' && <button className="text-[10px] text-blue-600 underline">预约购药</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
