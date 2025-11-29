
import React, { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange,
  isAuthenticated = false,
  onLoginClick,
  onLogoutClick
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: 'dashboard', label: '健康总览', icon: '📊' },
    { id: 'survey', label: '健康调查建档', icon: '📝' },
    { id: 'assessment', label: '风险评估与方案', icon: '📋' },
    { id: 'followup', label: '随访监测', icon: '📅' },
    { id: 'heatmap', label: '医疗服务热力图', icon: '🏥' }, // Added Heatmap
    { id: 'admin', label: '管理控制台', icon: '⚡' },
  ];

  return (
    // 添加 print:block print:h-auto print:overflow-visible 以重置 Flex 布局和屏幕高度限制
    <div className="flex h-screen bg-slate-50 overflow-hidden print:block print:h-auto print:overflow-visible">
      
      {/* Sidebar: 添加 dynamic width & opacity classes for transition */}
      {/* print:hidden 确保打印时隐藏 */}
      <aside 
        className={`bg-slate-800 text-white flex flex-col shadow-xl z-10 print:hidden transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
          isSidebarOpen ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'
        }`}
      >
        <div className="p-6 border-b border-slate-700 flex items-center gap-2 min-w-[256px]">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">Z</div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">郑州大学医院</h1>
            <p className="text-xs text-slate-400">健康管理中心</p>
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-2 min-w-[256px]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-[230px] flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 min-w-[256px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold shrink-0">
              Dr.
            </div>
            <div>
              <p className="text-sm font-medium">邱医生</p>
              <p className="text-xs text-slate-400">主检医生</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content: print:w-full print:h-auto print:m-0 确保占满纸张 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative print:h-auto print:overflow-visible print:block print:w-full transition-all duration-300">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm print:hidden shrink-0">
            <div className="flex items-center gap-4">
                {/* Toggle Sidebar Button */}
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
                  title={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    {isSidebarOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    )}
                  </svg>
                </button>

                <h2 className="text-xl font-bold text-slate-800">
                    {navItems.find(n => n.id === activeTab)?.label}
                </h2>
            </div>
            
            <div className="flex gap-4 items-center">
                {isAuthenticated ? (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-bold border border-green-200 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            管理员已登录
                        </span>
                        <button 
                            onClick={onLogoutClick}
                            className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 hover:bg-red-50 rounded transition-colors"
                        >
                            退出登录
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={onLoginClick}
                        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-slate-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <span>🔒</span> 管理员登录
                    </button>
                )}
                <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
                <button className="text-sm text-slate-600 hover:text-teal-600">帮助中心</button>
            </div>
         </header>
         {/* print:p-0 移除内边距 */}
         <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible print:h-auto">
            <div className="max-w-7xl mx-auto print:max-w-none print:w-full">
                {children}
            </div>
         </div>
      </main>
    </div>
  );
};
