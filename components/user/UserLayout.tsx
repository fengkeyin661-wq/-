
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<Props> = ({ activeTab, onTabChange, children }) => {
  const navItems = [
    { id: 'diet_motion', label: '饮食与运动', icon: '🥑' }, // Merged Diet & Exercise
    { id: 'medical', label: '寻医问药', icon: '🏥' }, // Medical, Drugs, Services
    { id: 'interaction', label: '互动咨询', icon: '💬' }, // Doctor chat, Community
    { id: 'profile', label: '我的健康', icon: '👤' }, // Profile, Records, Family Doctor
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        {children}
      </main>

      {/* Modern Glassmorphism Bottom Nav */}
      <nav className="absolute bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-slate-200 flex justify-around items-center h-20 pb-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 group relative ${
                isActive ? 'text-teal-600' : 'text-slate-400'
              }`}
            >
              <div className={`text-2xl mb-1 transition-all duration-300 p-2 rounded-2xl ${
                  isActive ? 'bg-teal-50 -translate-y-2 shadow-sm' : 'group-hover:-translate-y-1'
              }`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold absolute bottom-2 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
