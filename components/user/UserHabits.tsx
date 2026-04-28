
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
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">智能问诊</h1>
                <p className="text-xs text-slate-500 mt-1">AI健康助手为您提供健康咨询服务</p>
            </div>

            {/* Virtual Health Assistant (Baichuan) - Full Page */}
            <VirtualHealthAssistant userName={userName} fullPage record={record} assessment={assessment} />
        </div>
    );
};
