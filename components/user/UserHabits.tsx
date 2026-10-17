
import React from 'react';
import { HealthAssessment, HealthRecord } from '../../types';
import { VirtualHealthAssistant } from './VirtualHealthAssistant';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    userName?: string;
    record?: HealthRecord;
    onRefresh?: () => void;
}

export const UserHabits: React.FC<Props> = ({ userName, record, assessment }) => {
    return (
        <div className="bg-slate-50 min-h-full pb-32 animate-fadeIn">
            {/* Header */}
            <div className="bg-white px-6 py-5 border-b border-slate-100">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">智能问答助手</h1>
                <p className="text-xs text-slate-500 mt-1">结合档案解读体检与健康问题，不能替代线下就诊</p>
            </div>

            {/* Virtual Health Assistant (Baichuan) - Full Page */}
            <VirtualHealthAssistant userName={userName} fullPage record={record} assessment={assessment} />
        </div>
    );
};
