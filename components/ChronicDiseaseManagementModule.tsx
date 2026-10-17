import React from 'react';
import type {
  DiabetesStandaloneParticipant,
  HypertensionStandaloneParticipant,
  LipidStandaloneParticipant,
} from '../types';
import type { HealthArchive } from '../services/dataService';
import { DiabetesManagementModule } from './DiabetesManagementModule';
import { HypertensionManagementModule } from './HypertensionManagementModule';
import { LipidManagementModule } from './LipidManagementModule';

export type ChronicDiseaseSubTab = 'diabetes' | 'hypertension' | 'lipid';

const SUB_TABS: { id: ChronicDiseaseSubTab; label: string; icon: string }[] = [
  { id: 'diabetes', label: '糖尿病', icon: '🩸' },
  { id: 'hypertension', label: '高血压', icon: '🫀' },
  { id: 'lipid', label: '血脂异常', icon: '🧪' },
];

interface Props {
  activeSubTab: ChronicDiseaseSubTab;
  onSubTabChange: (tab: ChronicDiseaseSubTab) => void;
  diabetesParticipants: DiabetesStandaloneParticipant[];
  currentDiabetes: DiabetesStandaloneParticipant | null;
  onSelectDiabetes: (p: DiabetesStandaloneParticipant | null) => void;
  onRefreshDiabetes: () => void | Promise<void>;
  hypertensionParticipants: HypertensionStandaloneParticipant[];
  currentHypertension: HypertensionStandaloneParticipant | null;
  onSelectHypertension: (p: HypertensionStandaloneParticipant | null) => void;
  onRefreshHypertension: () => void | Promise<void>;
  lipidParticipants: LipidStandaloneParticipant[];
  currentLipid: LipidStandaloneParticipant | null;
  onSelectLipid: (p: LipidStandaloneParticipant | null) => void;
  onRefreshLipid: () => void | Promise<void>;
  archives?: HealthArchive[];
}

export const ChronicDiseaseManagementModule: React.FC<Props> = ({
  activeSubTab,
  onSubTabChange,
  diabetesParticipants,
  currentDiabetes,
  onSelectDiabetes,
  onRefreshDiabetes,
  hypertensionParticipants,
  currentHypertension,
  onSelectHypertension,
  onRefreshHypertension,
  lipidParticipants,
  currentLipid,
  onSelectLipid,
  onRefreshLipid,
  archives = [],
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col animate-fadeIn">
      <div className="mb-4 shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="mb-2 px-2 pt-1">
          <h2 className="text-lg font-black text-slate-800">慢性病管理</h2>
          <p className="text-xs text-slate-500">糖尿病、高血压、血脂异常专项筛查与评估</p>
        </div>
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          {SUB_TABS.map((tab) => {
            const active = activeSubTab === tab.id;
            const count =
              tab.id === 'diabetes'
                ? diabetesParticipants.length
                : tab.id === 'hypertension'
                  ? hypertensionParticipants.length
                  : lipidParticipants.length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSubTabChange(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeSubTab === 'diabetes' && (
          <DiabetesManagementModule
            participants={diabetesParticipants}
            currentParticipant={currentDiabetes}
            onSelectParticipant={onSelectDiabetes}
            onRefresh={onRefreshDiabetes}
            archives={archives}
          />
        )}
        {activeSubTab === 'hypertension' && (
          <HypertensionManagementModule
            participants={hypertensionParticipants}
            currentParticipant={currentHypertension}
            onSelectParticipant={onSelectHypertension}
            onRefresh={onRefreshHypertension}
            archives={archives}
          />
        )}
        {activeSubTab === 'lipid' && (
          <LipidManagementModule
            participants={lipidParticipants}
            currentParticipant={currentLipid}
            onSelectParticipant={onSelectLipid}
            onRefresh={onRefreshLipid}
            archives={archives}
          />
        )}
      </div>
    </div>
  );
};
