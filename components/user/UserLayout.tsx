
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<Props> = ({ activeTab, onTabChange, children }) => {
  const navItems = [
    { id: 'diet', label: '饮食', icon: '🥗' },
    { id: 'exercise', label: '运动', icon: '🏃' },
    { id: 'community', label: '社区', icon: '✨' }, // New Community Tab
    { id: 'medical', label: '医疗', icon: '🏥' },
    { id: 'profile', label: '我的', icon: '👤' },
  ];

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide bg-slate-50/50">
        {children}
      </main>

      {/* Modern Glassmorphism Bottom Nav */}
      <nav className="absolute bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-100 flex justify-around items-end h-20 pb-6 z-50">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${
                isActive ? 'text-teal-600' : 'text-slate-400'
              }`}
            >
              <span className={`text-2xl mb-1 transform transition-transform duration-300 ${
                isActive ? 'scale-110 -translate-y-1' : 'group-hover:scale-105'
              }`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-2 w-1 h-1 bg-teal-600 rounded-full"></span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
