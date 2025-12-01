
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';

export const PatientServices: React.FC<{ archive: HealthArchive }> = ({ archive }) => {
  const [activeTab, setActiveTab] = useState<'services' | 'knowledge'>('services');

  // Logic to determine recommended services
  const recommendations = [];
  const riskStr = JSON.stringify(archive.assessment_data).toLowerCase();
  
  if (riskStr.includes('血压') || riskStr.includes('心脏')) recommendations.push({ title: '24h动态血压', dept: '心内科', icon: '💓', color: 'bg-red-50 text-red-600' });
  if (riskStr.includes('血糖') || riskStr.includes('糖尿病')) recommendations.push({ title: '胰岛功能测定', dept: '内分泌', icon: '🩸', color: 'bg-blue-50 text-blue-600' });
  if (riskStr.includes('肺') || riskStr.includes('呼吸')) recommendations.push({ title: '肺部CT复查', dept: '呼吸科', icon: '🫁', color: 'bg-cyan-50 text-cyan-600' });
  if (riskStr.includes('胃') || riskStr.includes('肠')) recommendations.push({ title: '无痛胃肠镜', dept: '消化科', icon: '🥔', color: 'bg-orange-50 text-orange-600' });
  
  // Knowledge Articles (Mock)
  const articles = [
      { title: '体检报告里的“结节”都要切吗？', tag: '科普', readTime: '3min', image: '🩺' },
      { title: '地中海饮食：降压护心的最佳选择', tag: '饮食', readTime: '5min', image: '🥗' },
      { title: '失眠多梦？试试这3个助眠动作', tag: '生活', readTime: '2min', image: '🌙' },
  ];

  return (
    <div className="bg-slate-50 min-h-full pb-24 animate-fadeIn">
        <div className="bg-white px-5 pt-6 pb-2 sticky top-0 z-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">发现与服务</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('services')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'services' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                >
                    医疗服务
                </button>
                <button 
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'knowledge' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                >
                    健康百科
                </button>
            </div>
        </div>

        <div className="p-5 space-y-6">
            {activeTab === 'services' && (
                <>
                    {/* Personalized Recommendations */}
                    {recommendations.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                <span>✨</span> 专属推荐
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {recommendations.map((rec, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border border-transparent hover:border-slate-200 transition-all ${rec.color.replace('text-', 'bg-').replace('50', '50/50')}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-3 bg-white shadow-sm`}>
                                            {rec.icon}
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm mb-1">{rec.title}</div>
                                        <div className="text-xs opacity-70">{rec.dept}</div>
                                        <button className="mt-3 w-full py-1.5 bg-white rounded-lg text-xs font-bold shadow-sm hover:shadow text-slate-700">
                                            预约
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Department Grid */}
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
                            <span>🏥</span> 全科挂号
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 grid grid-cols-4 gap-y-6">
                            {[
                                {name:'内科', icon:'🩺'}, {name:'外科', icon:'🔪'}, {name:'妇科', icon:'🌸'}, {name:'儿科', icon:'👶'},
                                {name:'眼科', icon:'👁️'}, {name:'口腔', icon:'🦷'}, {name:'皮肤', icon:'✨'}, {name:'中医', icon:'🌿'}
                            ].map(d => (
                                <button key={d.name} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl hover:bg-slate-100 transition-colors">
                                        {d.icon}
                                    </div>
                                    <span className="text-xs font-medium text-slate-600">{d.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'knowledge' && (
                <div className="space-y-4 animate-slideInRight">
                    {/* Featured Article */}
                    <div className="relative h-48 rounded-2xl overflow-hidden shadow-md group cursor-pointer">
                        <img src="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Health" className="absolute w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-5">
                            <span className="bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-2">每日精选</span>
                            <h3 className="text-white font-bold text-lg leading-tight">运动是良医：如何科学制定个人的运动处方？</h3>
                        </div>
                    </div>

                    {/* Article List */}
                    <div className="space-y-3">
                        {articles.map((art, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-teal-200 transition-colors">
                                <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-3xl shrink-0">
                                    {art.image}
                                </div>
                                <div className="flex flex-col justify-between py-1">
                                    <h4 className="font-bold text-slate-800 text-sm line-clamp-2">{art.title}</h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{art.tag}</span>
                                        <span>{art.readTime} 阅读</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
