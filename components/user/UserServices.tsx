
import React, { useState } from 'react';
import { HealthEvent } from '../../types';

export const UserServices: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'events' | 'clinic'>('events');
  const [events, setEvents] = useState<HealthEvent[]>([
      { 
          id: '1', title: '春季心血管健康讲座', type: 'lecture', date: '2024-05-20', time: '14:30', 
          location: '门诊楼3楼会议室', doctor: '张主任', capacity: 50, registered: 32, description: '了解春季血压波动规律，科学预防心脑血管意外。', isRegistered: false
      },
      { 
          id: '2', title: '中医体质辨识义诊', type: 'clinic', date: '2024-05-22', time: '09:00-11:00', 
          location: '校医院南广场', description: '专家现场把脉，提供个性化养生建议。', capacity: 20, registered: 20, isRegistered: false
      },
      { 
          id: '3', title: '急救技能培训(CPR)', type: 'skill', date: '2024-05-25', time: '15:00', 
          location: '技能实训中心', description: '学习心肺复苏术和AED使用方法。', capacity: 15, registered: 5, isRegistered: true
      }
  ]);

  const handleRegister = (id: string) => {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, isRegistered: !e.isRegistered, registered: e.isRegistered ? e.registered - 1 : e.registered + 1 } : e));
      alert("操作成功！");
  };

  return (
    <div className="p-4 space-y-4 animate-fadeIn bg-slate-50 min-h-full">
      <div className="bg-white p-1 rounded-xl flex shadow-sm mb-2">
          <button 
             onClick={() => setActiveTab('events')}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'events' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
          >
             活动预约
          </button>
          <button 
             onClick={() => setActiveTab('clinic')}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'clinic' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
          >
             医疗服务
          </button>
      </div>

      {activeTab === 'events' && (
          <div className="space-y-4">
              {events.map(event => (
                  <div key={event.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-100">
                          <div className="flex items-center gap-2">
                              <span className="text-xl">{event.type === 'lecture' ? '🎤' : event.type === 'clinic' ? '🩺' : '⛑️'}</span>
                              <span className="font-bold text-slate-800 text-sm">{event.title}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              event.isRegistered ? 'bg-green-100 text-green-700' : 
                              event.registered >= event.capacity ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                              {event.isRegistered ? '已报名' : event.registered >= event.capacity ? '已满员' : '报名中'}
                          </span>
                      </div>
                      <div className="p-4">
                          <div className="flex items-start gap-3 mb-3 text-xs text-slate-500">
                              <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-1">
                                      <span>🕒</span> {event.date} {event.time}
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span>📍</span> {event.location}
                                  </div>
                                  {event.doctor && (
                                      <div className="flex items-center gap-1">
                                          <span>👨‍⚕️</span> {event.doctor}
                                      </div>
                                  )}
                              </div>
                              <div className="bg-slate-50 px-2 py-1 rounded text-center min-w-[60px]">
                                  <div className="font-bold text-slate-800">{event.registered}/{event.capacity}</div>
                                  <div className="text-[10px]">名额</div>
                              </div>
                          </div>
                          <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-2 rounded">
                              {event.description}
                          </p>
                          <button 
                             onClick={() => handleRegister(event.id)}
                             disabled={!event.isRegistered && event.registered >= event.capacity}
                             className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
                                 event.isRegistered 
                                 ? 'bg-red-50 text-red-600 border border-red-200' 
                                 : event.registered >= event.capacity 
                                   ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                   : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                             }`}
                          >
                             {event.isRegistered ? '取消报名' : event.registered >= event.capacity ? '名额已满' : '立即预约'}
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {activeTab === 'clinic' && (
          <div className="grid grid-cols-2 gap-4">
              {['全科门诊', '口腔科', '康复理疗', '心理咨询'].map((dept, i) => (
                  <button key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center gap-2 hover:border-teal-400 transition-colors">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl text-blue-500">
                          {i === 0 ? '🏥' : i === 1 ? '🦷' : i === 2 ? '💆' : '🧠'}
                      </div>
                      <span className="font-bold text-slate-700 text-sm">{dept}</span>
                      <span className="text-[10px] text-slate-400">可预约明日</span>
                  </button>
              ))}
              
              <div className="col-span-2 mt-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                      <h3 className="font-bold text-indigo-800 text-sm">AI 智能导诊</h3>
                      <p className="text-xs text-indigo-600 mt-1">不知道挂哪个科？问问 AI 助手</p>
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">开始咨询</button>
              </div>
          </div>
      )}
    </div>
  );
};
