
import React, { useState } from 'react';

export const UserMedical: React.FC = () => {
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
        <div className="min-h-full bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">医疗服务</h1>
                    <p className="text-xs text-slate-500 font-medium">便捷就医，专业守护</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">🏥</div>
            </div>

            <div className="p-4 space-y-8">

                {/* 1. Quick Actions Card */}
                <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider">快速通道</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer">
                            <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl shadow-lg shadow-blue-200">🩺</div>
                            <div className="text-center">
                                <div className="font-bold text-slate-800">在线问诊</div>
                                <div className="text-[10px] text-slate-500">图文咨询 5分钟回复</div>
                            </div>
                        </div>
                        <div className="bg-teal-50 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform cursor-pointer">
                            <div className="w-12 h-12 bg-teal-500 text-white rounded-full flex items-center justify-center text-2xl shadow-lg shadow-teal-200">📅</div>
                            <div className="text-center">
                                <div className="font-bold text-slate-800">预约挂号</div>
                                <div className="text-[10px] text-slate-500">免排队 实时号源</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Departments Grid */}
                <section>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 px-2">科室导航</h2>
                    <div className="grid grid-cols-4 gap-3">
                        {depts.map((d, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60 transition-opacity">
                                <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                    {i === 0 ? '🩺' : i === 1 ? '🔪' : i === 3 ? '🦷' : i === 6 ? '🌿' : '🏥'}
                                </div>
                                <span className="text-xs font-medium text-slate-600">{d}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Pharmacy Search */}
                <section className="bg-slate-100 rounded-3xl p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-800">药品查询</h2>
                        <span className="text-xs text-slate-500">实时库存</span>
                    </div>
                    <div className="relative mb-4">
                        <input 
                            className="w-full bg-white border-none rounded-xl p-3 pl-10 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="输入药品名称..."
                            value={drugSearch}
                            onChange={e => setDrugSearch(e.target.value)}
                        />
                        <span className="absolute left-3 top-3 text-slate-400">🔍</span>
                    </div>
                    <div className="space-y-2">
                        {filteredDrugs.map((d, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{d.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{d.spec}</div>
                                </div>
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                    d.stock === '充足' ? 'bg-green-100 text-green-700' : 
                                    d.stock === '少量' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                }`}>{d.stock}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Wiki (List) */}
                <section className="px-2">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">健康百科</h2>
                    <div className="space-y-3">
                        {['高血压日常护理', '糖尿病饮食禁忌', '季节性过敏防治', '腰椎间盘突出康复操'].map((title, i) => (
                            <div key={i} className="flex justify-between items-center py-3 border-b border-slate-200 last:border-0 cursor-pointer active:bg-slate-100 px-2 rounded-lg transition-colors">
                                <span className="text-sm font-bold text-slate-700">{title}</span>
                                <span className="text-slate-300 text-lg">›</span>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-10"></div>
            </div>
        </div>
    );
};
