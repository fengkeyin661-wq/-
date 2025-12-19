
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  unreadCount?: number;
}

export const UserLayout: React.FC<Props> = ({ activeTab, onTabChange, children, unreadCount = 0 }) => {
  const navItems = [
    { id: 'home', label: '首页', icon: '🏠' },
    { id: 'habits', label: '打卡', icon: '✅' },
    { id: 'diet_motion', label: '记录', icon: '🥑' },
    { id: 'medical', label: '医疗', icon: '🏥' },
    { id: 'community', label: '社区', icon: '🎉' },
    { id: 'profile', label: '我的', icon: '👤' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-slate-800">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 scrollbar-hide overscroll-y-contain">
        {children}
      </main>

      {/* Modern Glassmorphism Bottom Nav (iOS Style) */}
      <nav className="absolute bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-end h-[84px] pb-5 z-[80] shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full group relative transition-all duration-300 ease-out`}
            >
              <div className={`text-xl mb-1 transition-transform duration-300 relative ${
                  isActive ? 'scale-110 -translate-y-1' : 'group-hover:scale-105 opacity-60 grayscale-[0.5]'
              }`}>
                {item.icon}
              </div>
              
              <span className={`text-[10px] font-bold tracking-wide transition-all duration-300 ${
                  isActive ? 'text-teal-600 opacity-100 translate-y-0' : 'text-slate-400 opacity-0 translate-y-2 scale-75 hidden' 
              }`}>
                {isActive && item.label}
              </span>
              
              {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 bg-teal-600 rounded-full opacity-50"></span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
