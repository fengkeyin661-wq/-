import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: '健康总览', icon: '📊' },
    { id: 'survey', label: '健康调查建档', icon: '📝' },
    { id: 'assessment', label: '风险评估与方案', icon: '📋' },
    { id: 'followup', label: '随访监测', icon: '📅' },
    { id: 'admin', label: '管理控制台', icon: '⚡' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-white">H</div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">HealthGuard</h1>
            <p className="text-xs text-slate-400">职工健康管理中心</p>
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold">
              Dr.
            </div>
            <div>
              <p className="text-sm font-medium">李医生</p>
              <p className="text-xs text-slate-400">全科医师</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm print:hidden">
            <h2 className="text-xl font-bold text-slate-800">
                {navItems.find(n => n.id === activeTab)?.label}
            </h2>
            <div className="flex gap-4">
                <button className="text-sm text-slate-600 hover:text-teal-600">帮助中心</button>
                <button className="text-sm text-slate-600 hover:text-teal-600">设置</button>
            </div>
         </header>
         <div className="flex-1 overflow-auto p-8 print:p-0">
            <div className="max-w-7xl mx-auto print:max-w-none">
                {children}
            </div>
         </div>
      </main>
    </div>
  );
};