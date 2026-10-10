import React from 'react';

const CONTENT_PB = 'pb-[calc(84px+env(safe-area-inset-bottom)+16px)]';

interface Props {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  stickyHeaderExtra?: React.ReactNode;
  children: React.ReactNode;
  /** 首页 FAB 等需要额外底距 */
  extraBottomPad?: boolean;
  className?: string;
}

export const UserPortalPageShell: React.FC<Props> = ({
  title,
  subtitle,
  trailing,
  stickyHeaderExtra,
  children,
  extraBottomPad = false,
  className = '',
}) => {
  const pb = extraBottomPad
    ? 'pb-[calc(84px+env(safe-area-inset-bottom)+80px)]'
    : CONTENT_PB;

  return (
    <div className={`min-h-full bg-slate-50 ${className}`}>
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-800">{title}</h1>
            </div>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
        {stickyHeaderExtra}
      </div>
      <div className={`space-y-4 px-4 pt-3 ${pb}`}>{children}</div>
    </div>
  );
};

export const UserPortalSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <section className={className}>
    <h2 className="mb-2 px-0.5 text-sm font-bold text-slate-800">{title}</h2>
    {children}
  </section>
);
