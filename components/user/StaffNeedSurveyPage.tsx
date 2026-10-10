import React from 'react';
import { StaffNeedSurveyForm } from './StaffNeedSurveyForm';
import { closeNeedSurvey, getNeedSurveyShareUrl } from '../../services/staffNeedSurveyCatalog';

type Props = {
  checkupId?: string;
  userName?: string;
  onClose?: () => void;
};

export const StaffNeedSurveyPage: React.FC<Props> = ({ checkupId, userName, onClose }) => {
  const handleClose = () => {
    if (onClose) onClose();
    else closeNeedSurvey();
  };

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-slate-50 font-sans text-slate-800 md:shadow-2xl">
      <header className="shrink-0 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="关闭"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-black text-slate-800">郑州大学教职工健康服务中心</h1>
            <p className="text-[11px] text-slate-500">健康与居家照护需求调查</p>
          </div>
        </div>
      </header>
      <div id="need-survey-scroll" className="flex-1 overflow-y-auto overscroll-y-contain">
        <StaffNeedSurveyForm checkupId={checkupId} userName={userName} onClose={handleClose} />
      </div>
      <p className="sr-only">{getNeedSurveyShareUrl()}</p>
    </div>
  );
};
