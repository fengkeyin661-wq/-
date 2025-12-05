import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchArchives, deleteArchive, updateArchiveProfile, updateCriticalTrack, saveArchive, updateHealthRecordOnly, HealthArchive } from '../services/dataService';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from '../services/geminiService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { HealthProfile, CriticalTrackRecord, HealthRecord, HealthAssessment, RiskLevel, RiskAnalysisData } from '../types';
import { CriticalHandleModal } from './CriticalHandleModal';
import { generateSystemPortraits, evaluateRiskModels } from '../services/riskModelService';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
    onSelectPatient: (archive: HealthArchive, mode?: 'view' | 'edit' | 'followup' | 'assessment') => void;
    onDataUpdate?: () => void;
    isAuthenticated: boolean;
    onTabChange?: (tab: string) => void;
}

export const AdminConsole: React.FC<Props> = ({ onSelectPatient, onDataUpdate, isAuthenticated, onTabChange }) => {
    // --- Admin Console Logic ---
    const [archives, setArchives] = useState<HealthArchive[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Enhanced List State (Sorting, Filtering, Selection) ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'updated_at', direction: 'desc' });
    const [filterRisk, setFilterRisk] = useState<string>('ALL'); // ALL, RED, YELLOW, GREEN, CRITICAL
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Edit Modal State
    const [editingArchive, setEditingArchive] = useState<HealthArchive | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<HealthProfile | null>(null);

    // Critical Modal State
    const [criticalModalArchive, setCriticalModalArchive] = useState<HealthArchive | null>(null);

    // Batch Import Modal State
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Questionnaire Import Modal State
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const questionnaireInputRef = useRef<HTMLInputElement>(null);

    // Smart Batch Import Modal State (PDF/Word + AI)
    const [isSmartBatchModalOpen, setIsSmartBatchModalOpen] = useState(false);
    const [smartBatchFiles, setSmartBatchFiles] = useState<File[]>([]);
    const [smartBatchLogs, setSmartBatchLogs] = useState<string[]>([]);
    const [isSmartBatchProcessing, setIsSmartBatchProcessing] = useState(false);

    // Export Menu State
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    const configured = isSupabaseConfigured();

    // --- Effects ---
    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    // Setup PDF Worker globally for Admin Console as well
    useEffect(() => {
        const setupPdfWorker = async () => {
            const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;

            if (!lib.GlobalWorkerOptions) {
                console.warn("PDFJS GlobalWorkerOptions not found");
                return;
            }

            try {
                const response = await fetch(workerUrl);
                if (!response.ok) throw new Error("Failed to fetch worker script");
                const workerScript = await response.text();
                const blob = new Blob([workerScript], { type: "text/javascript" });
                const blobUrl = URL.createObjectURL(blob);
                lib.GlobalWorkerOptions.workerSrc = blobUrl;
            } catch (error) {
                lib.GlobalWorkerOptions.workerSrc = workerUrl;
            }
        };
        setupPdfWorker();
    }, []);

    const loadData = async () => {
        if (!configured) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setFetchError(null);
        setSelectedIds(new Set()); // Reset selection on reload
        try {
            const data = await fetchArchives();
            setArchives(data);
        } catch (error: unknown) {
            console.error("Load Data Error:", error);
            let errorMessage = "Unknown Error";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else {
                errorMessage = String(error);
            }
            setFetchError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`确定要删除 ${name} 的健康档案吗？此操作不可恢复。`)) {
            const success = await deleteArchive(id);
            if (success) {
                loadData();
                if (onDataUpdate) onDataUpdate();
            } else {
                alert('删除失败，请重试');
            }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`⚠️ 危险操作：确定要批量删除选中的 ${selectedIds.size} 份健康档案吗？\n此操作不可恢复！`)) {
            setLoading(true);
            let successCount = 0;
            // Execute deletion
            for (const id of Array.from(selectedIds)) {
                const success = await deleteArchive(id as string);
                if (success) successCount++;
            }
            alert(`批量删除完成，成功删除 ${successCount} 条。`);
            loadData();
            if (onDataUpdate) onDataUpdate();
            setLoading(false);
        }
    };

    // --- Batch Fix BMI Logic ---
    const handleBatchFixBMI = async () => {
        const candidates = archives.filter(a => {
            const b = a.health_record.checkup?.basics;
            if (!b) return false;
            // Check if height & weight exist (>0) BUT bmi is missing/zero
            const h = Number(b.height);
            const w = Number(b.weight);
            const bmi = Number(b.bmi);
            return h > 0 && w > 0 && (!bmi || bmi === 0);
        });

        if (candidates.length === 0) {
            alert("扫描完成：未发现有身高体重但缺失BMI的档案，数据完整。");
            return;
        }

        if (!confirm(`扫描发现 ${candidates.length} 份档案有身高体重但缺失BMI，是否立即自动计算并补全？`)) return;

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const arch of candidates) {
            try {
                const b = arch.health_record.checkup.basics;
                const h_cm = Number(b.height);
                const w_kg = Number(b.weight);
                const h_m = h_cm / 100;
                
                const newBmi = parseFloat((w_kg / (h_m * h_m)).toFixed(1));
                
                // Create updated health record
                const updatedRecord = {
                    ...arch.health_record,
                    checkup: {
                        ...arch.health_record.checkup,
                        basics: {
                            ...b,
                            bmi: newBmi
                        }
                    }
                };

                // Use dedicated lightweight update function to avoid overwriting follow-ups/schedule
                const success = await updateHealthRecordOnly(arch.checkup_id, updatedRecord);
                if (success) successCount++;
                else failCount++;
            } catch (e) {
                failCount++;
            }
        }

        setLoading(false);
        alert(`批量修复完成！\n成功补全: ${successCount} 条\n失败: ${failCount} 条`);
        loadData(); // Refresh list to show updated timestamps potentially
        if (onDataUpdate) onDataUpdate();
    };


    // --- Sorting & Filtering Logic ---
    const filteredArchives = useMemo(() => {
        let result = archives.filter(archive => {
            const term = searchTerm.toLowerCase();
            const matchSearch = (
                (archive.name || '').toLowerCase().includes(term) ||
                (archive.checkup_id || '').toLowerCase().includes(term) ||
                (archive.phone || '').toLowerCase().includes(term)
            );
            
            let matchRisk = false;
            if (filterRisk === 'ALL') {
                matchRisk = true;
            } else if (filterRisk === 'CRITICAL') {
                // Filter for critical active status
                matchRisk = (archive.assessment_data?.isCritical === true || (archive.assessment_data?.criticalWarning && archive.assessment_data.criticalWarning.includes('类'))) && archive.critical_track?.status !== 'archived';
            } else {
                matchRisk = archive.risk_level === filterRisk;
            }

            return matchSearch && matchRisk;
        });

        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '';
                let bVal: any = '';

                switch (sortConfig.key) {
                    case 'name':
                        aVal = a.name || ''; bVal = b.name || '';
                        break;
                    case 'department':
                        aVal = a.department || ''; bVal = b.department || '';
                        break;
                    case 'risk_level':
                         // Custom sort for risk: RED > YELLOW > GREEN
                         const riskOrder = { 'RED': 3, 'YELLOW': 2, 'GREEN': 1, 'UNKNOWN': 0 };
                         aVal = riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
                         bVal = riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
                         break;
                    case 'updated_at':
                         aVal = new Date(a.updated_at || a.created_at).getTime();
                         bVal = new Date(b.updated_at || b.created_at).getTime();
                         break;
                    default:
                        aVal = (a as any)[sortConfig.key];
                        bVal = (b as any)[sortConfig.key];
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [archives, searchTerm, filterRisk, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredArchives.map(a => a.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // --- Edit Handlers ---
    const handleEditClick = (archive: HealthArchive) => {
        setEditingArchive(archive);
        setEditForm(archive.health_record.profile);
        setIsEditModalOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!editingArchive || !editForm) return;
        const result = await updateArchiveProfile(editingArchive.id, editForm);
        if (result.success) {
            alert('基本信息更新成功');
            setIsEditModalOpen(false);
            setEditingArchive(null);
            loadData();
            if (onDataUpdate) onDataUpdate();
        } else {
            alert(`更新失败: ${result.message}`);
        }
    };

    // --- Critical Track Handlers ---
    const handleCriticalSave = async (record: CriticalTrackRecord) => {
        if (!criticalModalArchive) return;
        
        const res = await updateCriticalTrack(criticalModalArchive.checkup_id, record);
        if (res.success) {
            if (record.status === 'archived') {
                alert("危急值记录已归档！");
            } else {
                alert("记录已保存，已自动列入二次回访计划。");
            }
            setCriticalModalArchive(null);
            loadData();
            if (onDataUpdate) onDataUpdate();
        } else {
            alert("保存失败：" + res.message);
        }
    };

    // --- Smart Batch Import Logic (PDF/Word + AI) ---
    const handleSmartBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSmartBatchFiles(Array.from(e.target.files));
            setSmartBatchLogs([]);
        }
    };

    const extractTextFromFile = async (file: File): Promise<string> => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (fileType === 'txt') return await file.text();
        if (fileType === 'docx' || fileType === 'doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
        if (fileType === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;
            const loadingTask = lib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent