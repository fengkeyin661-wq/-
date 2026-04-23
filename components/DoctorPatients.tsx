
import React, { useState, useEffect, useRef } from 'react';
import { fetchInteractions, updateInteractionStatus, InteractionItem, ChatMessage, fetchMessages, sendMessage, getUnreadCount, markAsRead, fetchContent, saveContent, ContentItem, saveInteraction } from '../services/contentService';
import { findArchiveByCheckupId, HealthArchive, publishHealthDraft } from '../services/dataService';
import { extractTextFromFile } from '../services/fileParseService';
import { generateDraftFromText } from '../services/healthDraftService';
import { parseScheduleClosedDates } from '../services/doctorScheduleUtils';

interface Props {
    doctorId: string; 
    doctorName?: string;
    onSelectPatient: (archive: HealthArchive, mode: 'assessment' | 'followup') => void;
}

interface PatientData {
    interaction: InteractionItem;
    archive?: HealthArchive;
    unread?: number;
}

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [{id: 'AM', label: '上午'}, {id: 'PM', label: '下午'}];

export const DoctorPatients: React.FC<Props> = ({ doctorId, doctorName, onSelectPatient }) => {
    // 将默认 Tab 设为 'tasks'
    const [mainTab, setMainTab] = useState<'tasks' | 'patients' | 'schedule' | 'bookings'>('tasks');
    const [signedPatients, setSignedPatients] = useState<PatientData[]>([]);
    const [pendingRequests, setPendingRequests] = useState<InteractionItem[]>([]);
    const [confirmedBookings, setConfirmedBookings] = useState<InteractionItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Schedule State
    const [weeklySchedule, setWeeklySchedule] = useState<Record<string, string[]>>({});
    const [slotQuotas, setSlotQuotas] = useState<Record<string, Record<string, number>>>({});
    const [closedDates, setClosedDates] = useState<string[]>([]);
    const [closedDateInput, setClosedDateInput] = useState('');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    // Chat State
    const [chatPatient, setChatPatient] = useState<PatientData | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [uploadPatientId, setUploadPatientId] = useState<string>('');

    const totalUnread = signedPatients.reduce((acc, curr) => acc + (curr.unread || 0), 0);

    const matchesCurrentDoctor = (interaction: InteractionItem) => {
        if (interaction.targetId === doctorId) return true;
        if (doctorName && interaction.targetName === doctorName) return true;
        return false;
    };

    useEffect(() => {
        loadData();
        loadDoctorProfile();
    }, [doctorId]);

    useEffect(() => {
        let interval: any;
        if (chatPatient) {
            loadMessages();
            markAsRead(doctorId, chatPatient.interaction.userId).then(() => {
                 setSignedPatients(prev => prev.map(p => p.interaction.userId === chatPatient.interaction.userId ? { ...p, unread: 0 } : p));
            });
            interval = setInterval(loadMessages, 3000);
        }
        return () => clearInterval(interval);
    }, [chatPatient]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const loadDoctorProfile = async () => {
        const allDocs = await fetchContent('doctor');
        const me = allDocs.find(d => d.id === doctorId);
        if (me) {
            if (me.details?.weeklySchedule) setWeeklySchedule(me.details.weeklySchedule);
            if (me.details?.slotQuotas) setSlotQuotas(me.details.slotQuotas);
            const closed = parseScheduleClosedDates(me.details);
            setClosedDates([...closed].sort());
        }
    };

    const loadData = async () => {
        if (!chatPatient) setLoading(true);
        const interactions = await fetchInteractions();
        
        // 1. 获取已签约用户
        const signings = interactions
            .filter(i => i.type === 'doctor_signing' && matchesCurrentDoctor(i) && i.status === 'confirmed');

        const patientsList: PatientData[] = [];
        const seenUserIds = new Set<string>();
        
        for (const s of signings) {
            if (seenUserIds.has(s.userId)) continue;
            seenUserIds.add(s.userId);
            let archive = await findArchiveByCheckupId(s.userId);
            let unreadCount = await getUnreadCount(doctorId, s.userId);
            patientsList.push({ interaction: s, archive: archive || undefined, unread: unreadCount });
        }
        setSignedPatients(patientsList);

        // 2. 获取已确认预约（日程表）
        const confirmed = interactions.filter(i => i.type === 'doctor_booking' && matchesCurrentDoctor(i) && i.status === 'confirmed');
        setConfirmedBookings(confirmed);

        // 3. 聚合待办任务（核心修改）
        const requests = interactions.filter(i => 
            i.status === 'pending' && 
            (
                // 自己的签约申请
                (i.type === 'doctor_signing' && matchesCurrentDoctor(i)) || 
                // 自己的挂号预约
                (i.type === 'doctor_booking' && matchesCurrentDoctor(i)) ||
                // 签约用户的药品订单（由签约医生负责审核处方合理性）
                (i.type === 'drug_order' && seenUserIds.has(i.userId)) ||
                // 检查结果上传（由目标医生审核发布草案）
                (i.type === 'check_result_upload' && matchesCurrentDoctor(i))
            )
        );
        setPendingRequests(requests);
        if (!chatPatient) setLoading(false);
    };

    const loadMessages = async () => {
        if (!chatPatient) return;
        const msgs = await fetchMessages(chatPatient.interaction.userId, doctorId);
        setChatMessages(msgs);
    };

    const toggleSchedule = (dayKey: string, slotId: string) => {
        const current = weeklySchedule[dayKey] || [];
        let updated = [];
        if (current.includes(slotId)) {
            updated = current.filter(s => s !== slotId);
        } else {
            updated = [...current, slotId];
            if (!slotQuotas[dayKey]?.[slotId]) {
                setSlotQuotas(prev => ({
                    ...prev,
                    [dayKey]: { ...(prev[dayKey] || {}), [slotId]: 10 } 
                }));
            }
        }
        setWeeklySchedule({ ...weeklySchedule, [dayKey]: updated });
    };

    const handleQuotaChange = (dayKey: string, slotId: string, value: number) => {
        setSlotQuotas(prev => ({
            ...prev,
            [dayKey]: { ...(prev[dayKey] || {}), [slotId]: Math.max(1, value) }
        }));
    };

    const addClosedDate = () => {
        const v = closedDateInput.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
        if (closedDates.includes(v)) return;
        setClosedDates([...closedDates, v].sort());
        setClosedDateInput('');
    };

    const removeClosedDate = (d: string) => {
        setClosedDates(closedDates.filter((x) => x !== d));
    };

    const saveSchedule = async () => {
        setIsSavingSchedule(true);
        try {
            const allDocs = await fetchContent('doctor');
            const me = allDocs.find(d => d.id === doctorId);
            if (!me) throw new Error("未找到医生信息");

            const scheduleClosedDates = [...new Set(closedDates)].filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
            const updatedMe = {
                ...me,
                details: { ...me.details, weeklySchedule, slotQuotas, scheduleClosedDates }
            };
            await saveContent(updatedMe);
            alert("设置已保存！");
        } catch (e) {
            alert("保存失败");
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleAudit = async (id: string, pass: boolean) => {
        if (confirm(`确定要${pass ? '通过' : '拒绝'}此申请吗？`)) {
            const req = pendingRequests.find(r => r.id === id);
            if (req?.type === 'check_result_upload' && pass) {
                const pub = await publishHealthDraft(req.userId, doctorName || doctorId);
                if (!pub.success) {
                    alert(pub.message || '草案发布失败');
                    return;
                }
            }
            await updateInteractionStatus(id, pass ? 'confirmed' : 'cancelled');
            loadData();
        }
    };

    // 统计逻辑
    const taskStats = {
        signing: pendingRequests.filter(r => r.type === 'doctor_signing').length,
        booking: pendingRequests.filter(r => r.type === 'doctor_booking').length,
        drug: pendingRequests.filter(r => r.type === 'drug_order').length,
        upload: pendingRequests.filter(r => r.type === 'check_result_upload').length
    };

    const handleUploadCheckResult = async (checkupId: string, file: File) => {
        try {
            const text = await extractTextFromFile(file);
            const draftRes = await generateDraftFromText(
                checkupId,
                text,
                'upload',
                `医生端上传: ${file.name}`
            );
            if (!draftRes.success) {
                alert(draftRes.message || '草案生成失败');
                return;
            }
            await saveInteraction({
                id: `check_result_upload_${Date.now()}`,
                type: 'check_result_upload',
                userId: checkupId,
                userName: signedPatients.find((p) => p.interaction.userId === checkupId)?.interaction.userName || '用户',
                targetId: doctorId,
                targetName: doctorName || '签约医生',
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details: `检查结果上传: ${file.name}`,
            });
            alert('检查结果上传成功，AI草案已生成并进入待审核。');
            await loadData();
        } catch (e: any) {
            alert(`上传失败: ${e.message || e}`);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col relative animate-fadeIn">
            {/* Top Navigation */}
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 rounded-t-xl gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span>🩺</span> 医生工作站
                </h2>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm flex-wrap">
                    <button 
                        onClick={() => setMainTab('tasks')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'tasks' ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        待办任务 {pendingRequests.length > 0 && <span className={`${mainTab === 'tasks' ? 'bg-white text-teal-600' : 'bg-teal-600 text-white'} text-[10px] px-1.5 rounded-full`}>{pendingRequests.length}</span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('bookings')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'bookings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        预约清单 {confirmedBookings.length > 0 && <span className="bg-slate-100 text-indigo-600 text-[10px] px-1.5 rounded-full">{confirmedBookings.length}</span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('patients')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'patients' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        我的用户 {totalUnread > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                    </button>
                    <button 
                        onClick={() => setMainTab('schedule')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${mainTab === 'schedule' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        🗓️ 出诊设置
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
                {loading && mainTab !== 'schedule' ? (
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                ) : (
                    <>
                        {/* 1. 待办任务视图 */}
                        {mainTab === 'tasks' && (
                            <div className="space-y-6 max-w-5xl mx-auto">
                                {/* 统计面板 */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">待处理签约</div>
                                        <div className="text-2xl font-black text-blue-600">{taskStats.signing} <span className="text-xs font-normal text-slate-400">人</span></div>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-teal-100 shadow-sm">
                                        <div className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1">待确认挂号</div>
                                        <div className="text-2xl font-black text-teal-600">{taskStats.booking} <span className="text-xs font-normal text-slate-400">位</span></div>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm">
                                        <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">待配药申请</div>
                                        <div className="text-2xl font-black text-orange-600">{taskStats.drug} <span className="text-xs font-normal text-slate-400">件</span></div>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                                        <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">待审检查上传</div>
                                        <div className="text-2xl font-black text-purple-600">{taskStats.upload} <span className="text-xs font-normal text-slate-400">份</span></div>
                                    </div>
                                </div>

                                {/* 任务列表 */}
                                {pendingRequests.length === 0 ? (
                                    <div className="text-center py-20 text-slate-300">
                                        <div className="text-6xl mb-4 opacity-20">✅</div>
                                        <p className="font-bold">所有任务已处理完毕</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {pendingRequests.map(req => (
                                            <div key={req.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                {/* 类型色标 */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                                    req.type === 'doctor_signing' ? 'bg-blue-500' : 
                                                    req.type === 'doctor_booking' ? 'bg-teal-500' :
                                                    req.type === 'drug_order' ? 'bg-orange-500' : 'bg-purple-500'
                                                }`}></div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tight ${
                                                            req.type === 'doctor_signing' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                                                            req.type === 'doctor_booking' ? 'bg-teal-50 text-teal-600 border border-teal-100' : 
                                                            req.type === 'drug_order' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                            'bg-purple-50 text-purple-600 border border-purple-100'
                                                        }`}>
                                                            {req.type === 'doctor_signing' ? '签约申请' : req.type === 'doctor_booking' ? '挂号预约' : req.type === 'drug_order' ? '药品预订' : '检查上传'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">提交时间: {req.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl shadow-inner border border-slate-100">
                                                            {req.type === 'doctor_signing' ? '🤝' : req.type === 'doctor_booking' ? '📅' : req.type === 'drug_order' ? '💊' : '🧾'}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-lg leading-tight">{req.userName}</div>
                                                            <div className="text-xs text-slate-500 mt-1 line-clamp-1">{req.details}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 shrink-0">
                                                    <button 
                                                        onClick={async () => {
                                                            const arch = await findArchiveByCheckupId(req.userId);
                                                            if (arch) onSelectPatient(arch, 'assessment');
                                                            else alert("未找到该用户健康档案");
                                                        }}
                                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                                                    >
                                                        查看档案
                                                    </button>
                                                    <div className="w-px h-8 bg-slate-100 mx-1 self-center"></div>
                                                    <button onClick={() => handleAudit(req.id, false)} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold">拒绝</button>
                                                    <button onClick={() => handleAudit(req.id, true)} className={`px-6 py-2 rounded-xl text-xs font-black text-white shadow-lg shadow-opacity-20 active:scale-95 transition-transform ${
                                                        req.type === 'doctor_signing' ? 'bg-blue-600 shadow-blue-200' : 
                                                        req.type === 'doctor_booking' ? 'bg-teal-600 shadow-teal-200' : 
                                                        req.type === 'drug_order' ? 'bg-orange-500 shadow-orange-200' :
                                                        'bg-purple-600 shadow-purple-200'
                                                    }`}>
                                                        {req.type === 'check_result_upload' ? '通过并发布草案' : '通过并处理'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. 预约清单（已确认） */}
                        {mainTab === 'bookings' && (
                            <div className="space-y-6">
                                {confirmedBookings.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">近期暂无已约人员</div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                                                <tr>
                                                    <th className="p-4">就诊时段</th>
                                                    <th className="p-4">人员信息</th>
                                                    <th className="p-4">详情备注</th>
                                                    <th className="p-4 text-center">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {confirmedBookings.map(bk => (
                                                    <tr key={bk.id} className="hover:bg-blue-50/20 transition-colors">
                                                        <td className="p-4">
                                                            <div className="font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block">
                                                                {bk.details?.match(/周[一二三四五六日][上下]午/)?.[0] || '常规时段'}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800">{bk.userName}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">ID: {bk.userId}</div>
                                                        </td>
                                                        <td className="p-4 text-slate-500 text-xs italic">{bk.details}</td>
                                                        <td className="p-4 text-center">
                                                            <button 
                                                                onClick={async () => {
                                                                    const arch = await findArchiveByCheckupId(bk.userId);
                                                                    if (arch) onSelectPatient(arch, 'followup');
                                                                }}
                                                                className="text-xs bg-slate-900 text-white px-4 py-2 rounded-xl font-bold shadow-md active:scale-95"
                                                            >
                                                                开始诊疗/随访
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. 我的用户列表 */}
                        {mainTab === 'patients' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {signedPatients.length === 0 ? (
                                    <div className="col-span-full text-center py-20 text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-3xl">尚未签约任何教职工</div>
                                ) : (
                                    signedPatients.map((item) => (
                                        <div key={item.interaction.id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-all bg-white relative group">
                                            {item.unread! > 0 && <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-bold border-2 border-white animate-bounce shadow-sm">{item.unread}</div>}
                                            <div className="flex items-center gap-4 mb-5">
                                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-slate-50">
                                                    {item.archive?.gender === '女' ? '👩' : '👨'}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-lg leading-tight">{item.interaction.userName}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{item.archive?.age || '?'}岁 · {item.archive?.department || '部门未录入'}</div>
                                                    <div className="text-[11px] text-purple-600 mt-1">
                                                        居家监测记录：{item.archive?.home_monitoring_logs?.length || 0} 条
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <button onClick={() => item.archive && onSelectPatient(item.archive, 'assessment')} className="py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">查看评估</button>
                                                <button onClick={() => item.archive && onSelectPatient(item.archive, 'followup')} className="py-2 bg-teal-50 text-teal-600 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors">随访监测</button>
                                                <button
                                                    onClick={() => {
                                                        setUploadPatientId(item.interaction.userId);
                                                        uploadInputRef.current?.click();
                                                    }}
                                                    className="col-span-2 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all shadow-md active:scale-95"
                                                >
                                                    上传检查结果并生成草案
                                                </button>
                                                <button onClick={() => setChatPatient(item)} className="col-span-2 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                                                    <span>💬</span> 咨询交流
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 4. 出诊设置视图 */}
                        {mainTab === 'schedule' && (
                            <div className="max-w-5xl mx-auto animate-fadeIn pb-20">
                                <div className="bg-slate-800 text-white p-6 rounded-3xl mb-8 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                                    <h3 className="text-xl font-bold flex items-center gap-3 relative z-10">
                                        <span>🗓️</span> 出诊计划与号源限额
                                    </h3>
                                    <p className="text-sm opacity-60 mt-2 max-w-2xl relative z-10">设置每周常规出诊时段；可在下方添加「例外不出诊日期」（如国定假日、调休休息日）。用户在预约时，系统会根据限号量判断是否约满，且不会展示例外日期。</p>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-x-auto shadow-sm">
                                    <table className="w-full text-center border-collapse min-w-[700px]">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-200">时段</th>
                                                {DAYS.map(day => (
                                                    <th key={day} className="p-5 text-sm font-black text-slate-800">{day}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {SLOTS.map(slot => (
                                                <tr key={slot.id} className="border-b border-slate-100 last:border-0">
                                                    <td className="p-5 bg-slate-50/30 font-black text-slate-500 text-xs border-r border-slate-200 uppercase tracking-widest">{slot.label}</td>
                                                    {DAY_KEYS.map(dayKey => {
                                                        const isActive = weeklySchedule[dayKey]?.includes(slot.id);
                                                        const quota = slotQuotas[dayKey]?.[slot.id] || 10;
                                                        return (
                                                            <td key={dayKey} className="p-3 align-top">
                                                                <div className={`p-4 rounded-3xl transition-all duration-300 flex flex-col gap-3 ${
                                                                    isActive 
                                                                    ? 'bg-white border-2 border-teal-500 shadow-xl shadow-teal-50 scale-105 relative z-10' 
                                                                    : 'bg-slate-50/50 border-2 border-dashed border-slate-100'
                                                                }`}>
                                                                    <button 
                                                                        onClick={() => toggleSchedule(dayKey, slot.id)}
                                                                        className={`py-2 rounded-2xl text-xs font-black transition-all ${isActive ? 'bg-teal-500 text-white' : 'text-slate-300 hover:text-slate-400'}`}
                                                                    >
                                                                        {isActive ? '出诊中' : '休息'}
                                                                    </button>
                                                                    
                                                                    {isActive && (
                                                                        <div className="flex flex-col gap-1.5 items-center mt-1">
                                                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">号源限额</span>
                                                                            <input 
                                                                                type="number" 
                                                                                min="1"
                                                                                value={quota}
                                                                                onChange={(e) => handleQuotaChange(dayKey, slot.id, parseInt(e.target.value) || 1)}
                                                                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs text-center font-black text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-8 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                                    <h4 className="text-sm font-black text-slate-800 mb-1">例外不出诊日期</h4>
                                    <p className="text-xs text-slate-500 mb-4">已添加的公历日期全天不出诊（上下午均不可约），用于长假、调休休息日等；与上方周计划同时生效。</p>
                                    <div className="flex flex-wrap items-end gap-3 mb-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">选择日期</label>
                                            <input
                                                type="date"
                                                value={closedDateInput}
                                                onChange={(e) => setClosedDateInput(e.target.value)}
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addClosedDate}
                                            className="rounded-xl bg-teal-600 text-white px-5 py-2 text-sm font-black hover:bg-teal-700 transition-colors"
                                        >
                                            添加
                                        </button>
                                    </div>
                                    {closedDates.length === 0 ? (
                                        <p className="text-xs text-slate-400 py-2">暂无例外日期</p>
                                    ) : (
                                        <ul className="flex flex-wrap gap-2">
                                            {closedDates.map((d) => (
                                                <li
                                                    key={d}
                                                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 pl-3 pr-1 py-1 text-xs font-bold text-slate-700"
                                                >
                                                    {d}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeClosedDate(d)}
                                                        className="h-7 w-7 rounded-full hover:bg-slate-200 text-slate-500 font-black leading-none"
                                                        aria-label={`删除 ${d}`}
                                                    >
                                                        ×
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-10 flex justify-center">
                                    <button 
                                        onClick={saveSchedule}
                                        disabled={isSavingSchedule}
                                        className="bg-slate-900 text-white px-16 py-4 rounded-[2rem] font-black shadow-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        {isSavingSchedule ? '正在同步数据...' : '💾 保存所有设置'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && uploadPatientId) handleUploadCheckResult(uploadPatientId, f);
                    e.currentTarget.value = '';
                }}
            />

            {/* Chat Modal */}
            {chatPatient && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-[#F0F2F5] w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
                        <div className="bg-white px-6 py-4 flex justify-between items-center shadow-sm border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                                    {chatPatient.archive?.gender === '女' ? '👩' : '👨'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{chatPatient.interaction.userName}</h3>
                                    <p className="text-[10px] text-green-600 font-medium">正在咨询中</p>
                                </div>
                            </div>
                            <button onClick={() => setChatPatient(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {chatMessages.map(msg => {
                                const isMe = msg.senderRole === 'doctor';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm'}`}>
                                            {msg.messageType === 'image' && msg.mediaUrl ? (
                                                <div className="space-y-2">
                                                    <img src={msg.mediaUrl} alt="chat" className="max-h-64 rounded-lg border border-slate-200" />
                                                    <div>{msg.content}</div>
                                                </div>
                                            ) : msg.messageType === 'card_recommend' ? (
                                                <div>
                                                    <div className="font-bold mb-1">{msg.metadata?.title || '推荐内容'}</div>
                                                    <div className="text-xs opacity-90">{msg.metadata?.description || msg.content}</div>
                                                </div>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="bg-white p-4 flex gap-3 border-t">
                            <input className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="回复患者..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMsg()} />
                            <button onClick={handleSendMsg} className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors">发送</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    async function handleSendMsg() {
        if (!chatPatient || !chatInput.trim()) return;
        await sendMessage({ senderId: doctorId, senderRole: 'doctor', receiverId: chatPatient.interaction.userId, content: chatInput });
        setChatInput('');
        loadMessages();
    }
};
