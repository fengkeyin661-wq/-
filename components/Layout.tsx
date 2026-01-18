
import React, { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAuthenticated?: boolean;
  currentUserRole?: string | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange,
  isAuthenticated = false,
  currentUserRole,
  onLoginClick,
  onLogoutClick
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: '工作台首页', icon: '📊', roles: ['admin', 'doctor'] },
    { id: 'survey', label: '智能建档/识别', icon: '📝', roles: ['admin', 'doctor'] },
    { id: 'assessment', label: '风险评估报告', icon: '📋', roles: ['admin', 'doctor'] },
    { id: 'followup', label: '检后干预中心', icon: '🎯', roles: ['admin', 'doctor'] }, // Emphasize Intervention
    { id: 'risk_portrait', label: '危急值闭环', icon: '🛡️', roles: ['admin', 'doctor'] }, 
    { id: 'heatmap', label: '业务潜力地图', icon: '🏥', roles: ['admin', 'doctor'] },
    { id: 'admin', label: '系统管理', icon: '⚡', roles: ['admin'] },
  ];

  const visibleItems = isAuthenticated 
    ? navItems.filter(item => item.roles.includes(currentUserRole || 'admin'))
    : navItems.filter(item => ['dashboard', 'survey', 'assessment', 'followup'].includes(item.id));

  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden print:block print:h-auto print:overflow-visible">
      
      <aside 
        className={`bg-slate-900 text-white flex flex-col shadow-2xl z-10 print:hidden transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center gap-2 min-w-[256px]">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-teal-500/20">Z</div>
          <div>
            <h1 className="text-lg font-black tracking-tight">郑大健康管家</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Post-Checkup Care</p>
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-2 min-w-[256px] overflow-y-auto">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-[230px] flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-teal-600 text-white shadow-xl shadow-teal-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 min-w-[256px]">
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-sm font-bold shadow-lg shadow-teal-500/20">
              Dr.
            </div>
            <div>
              <p className="text-sm font-bold">{currentUserRole === 'admin' ? '中心负责人' : '临床医师'}</p>
              <p className="text-[10px] text-teal-500 font-bold">在线工作站</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative print:h-auto print:overflow-visible print:block print:w-full">
         <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 shadow-sm print:hidden shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <h2 className="text-xl font-black text-slate-800">
                    {navItems.find(n => n.id === activeTab)?.label}
                </h2>
            </div>
            
            <div className="flex gap-4 items-center">
                {isAuthenticated ? (
                    <button onClick={onLogoutClick} className="text-xs text-red-500 font-bold px-4 py-2 hover:bg-red-50 rounded-full transition-colors">退出登录</button>
                ) : (
                    <button onClick={onLoginClick} className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-black shadow-lg">后台入口</button>
                )}
            </div>
         </header>
         <div className="flex-1 overflow-auto p-8 bg-[#fcfdfe]">
            <div className="max-w-7xl mx-auto">
                {children}
            </div>
         </div>
      </main>
    </div>
  );
};
