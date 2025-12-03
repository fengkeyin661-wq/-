
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<Props> = ({ activeTab, onTabChange, children }) => {
  const navItems = [
    { id: 'diet', label: '健康饮食', icon: '🥗' },
    { id: 'exercise', label: '科学运动', icon: '🏃' },
    { id: 'medical', label: '医学服务', icon: '🏥' },
    { id: 'profile', label: '个人数据', icon: '👤' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        {children}
      </main>

      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-around items-center h-16 z-50 pb-safe">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              activeTab === item.id ? 'text-teal-600' : 'text-slate-400'
            }`}
          >
            <span className={`text-2xl mb-1 transform transition-transform ${activeTab === item.id ? 'scale-110' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
