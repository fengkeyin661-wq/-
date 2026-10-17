import React from 'react';
import { ModalPortal } from './ModalPortal';

interface Props {
  onClick: () => void;
}

/** 固定于视口右下角，不随 Tab 内容滚动 */
export const HealthAssistantFab: React.FC<Props> = ({ onClick }) => (
  <ModalPortal lockScroll={false}>
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom)+16px)] z-[55]">
      <div className="mx-auto flex w-full max-w-md justify-end px-4">
        <button
          type="button"
          aria-label="健康助手"
          title="健康助手 · 智能问答"
          onClick={onClick}
          className="health-assistant-fab pointer-events-auto group relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_8px_28px_rgba(13,148,136,0.45)] ring-4 ring-white/90 transition-transform hover:from-teal-600 hover:to-emerald-700 active:scale-95"
        >
          <span className="absolute inset-0 rounded-full bg-teal-400/30 blur-md opacity-70 group-hover:opacity-90" />
          <svg
            viewBox="0 0 48 48"
            className="relative h-8 w-8 drop-shadow-sm"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <circle cx="24" cy="20" r="9" fill="white" fillOpacity="0.95" />
            <path
              d="M14 38c0-5.523 4.477-10 10-10s10 4.477 10 10"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M32 14a6 6 0 0 1-6 6"
              stroke="#0f766e"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="21" cy="19" r="1.2" fill="#0f766e" />
            <circle cx="27" cy="19" r="1.2" fill="#0f766e" />
            <path d="M22 23c1.5 1 2.5 1 4 0" stroke="#0f766e" strokeWidth="1.5" strokeLinecap="round" />
            <path
              d="M34 8v6M31 11h6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </ModalPortal>
);
