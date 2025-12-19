
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  unreadCount?: number;
}

export const UserLayout: React.FC<Props> = ({ activeTab, onTabChange, children, unreadCount = 0 }) => {
  const navItems = [
    { id: 'habits', label: '今日', icon: '🗓️' },
    { id: 'diet_motion', label: '生活', icon: '🥗' },
    { id: 'medical', label: '医疗', icon: '🩺' },
    { id: 'community', label: '发现', icon: '🌍' },
    { id: 'interaction', label: '咨询', icon: '💬' },
    { id: 'profile', label: '我的', icon: '👤' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7] max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans">
      {/* 沉浸式主体内容 */}
      <main className="flex-1 overflow-y-auto pb-32 pt-6 px-4 scrollbar-hide overscroll-y-contain">
        {children}
      </main>

      {/* 国际化主流 Tab Bar (Floating Glass Effect) */}
      <div className="absolute bottom-6 left-4 right-4 z-50">
        <nav className="bg-white/80 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] flex justify-around items-center h-20 px-4 shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="flex flex-col items-center justify-center flex-1 transition-all duration-300 relative"
              >
                <div className={`text-2xl mb-1 transition-all ${isActive ? 'scale-125 translate-y-[-4px]' : 'opacity-40 grayscale'}`}>
                  {item.icon}
                  {item.id === 'interaction' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-tighter transition-all duration-300 ${isActive ? 'text-black opacity-100' : 'text-slate-400 opacity-0'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
