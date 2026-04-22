
import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  unreadCount?: number;
  /** 档案未完善时顶部提示 */
  profileIncompleteBanner?: string | null;
}

export const UserLayout: React.FC<Props> = ({
  activeTab,
  onTabChange,
  children,
  unreadCount = 0,
  profileIncompleteBanner,
}) => {
  const navItems = [
    { id: 'habits', label: '问诊', icon: '🤖' }, // 智能问诊（虚拟健康助手）
    { id: 'community', label: '发现', icon: '🎯' }, // 社区+医疗+饮食资源
    { id: 'doctors', label: '资源', icon: '🩺' }, // 医生/医疗资源
    { id: 'interaction', label: '管家', icon: '💬' }, // 健康管家互动
    { id: 'profile', label: '我的', icon: '👤' },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-slate-50 font-sans text-slate-800 md:shadow-2xl">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-y-contain pb-[calc(84px+env(safe-area-inset-bottom)+16px)]">
        {profileIncompleteBanner ? (
          <div
            className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-900"
            role="status"
          >
            {profileIncompleteBanner}
          </div>
        ) : null}
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="sticky bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-6px_18px_rgba(15,23,42,0.06)] pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div className="flex h-[78px] items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="group relative flex h-14 min-w-[64px] flex-col items-center justify-center rounded-2xl px-2 transition-all duration-200 active:scale-95"
              aria-label={item.label}
            >
              <div className={`relative mb-1 text-xl transition-transform duration-200 ${
                  isActive ? 'scale-105 text-teal-600' : 'text-slate-500 group-hover:scale-105'
              }`}>
                {item.icon}
                
                {/* Notification Badge */}
                {item.id === 'interaction' && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
              </div>
              
              <span className={`text-xs font-semibold tracking-wide transition-colors duration-200 ${
                  isActive ? 'text-teal-600' : 'text-slate-500'
              }`}>
                {item.label}
              </span>

              {isActive && (
                  <span className="absolute -bottom-1 h-1 w-8 rounded-full bg-teal-600/70"></span>
              )}
            </button>
          );
        })}
        </div>
      </nav>
    </div>
  );
};
