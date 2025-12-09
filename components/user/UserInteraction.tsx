
import React, { useState, useEffect, useRef } from 'react';
import { fetchContent, saveContent, fetchInteractions, saveInteraction, updateInteractionStatus, ContentItem, InteractionItem, ChatMessage, fetchMessages, sendMessage } from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';

interface Props {
    userId: string;
    archive?: HealthArchive;
}

export const UserInteraction: React.FC<Props> = ({ userId, archive }) => {
    const [events, setEvents] = useState<ContentItem[]>([]);
    const [interactions, setInteractions] = useState<InteractionItem[]>([]);
    
    // Segments: Chat vs Event
    const [activeSegment, setActiveSegment] = useState<'chat' | 'event'>('chat');
    
    // Event Sub Tabs: Lobby, Joined, Managed
    const [eventSubTab, setEventSubTab] = useState<'lobby' | 'joined' | 'managed'>('lobby');
    
    const CURRENT_USER_NAME = archive?.name || '我'; 

    // Chat State
    const [signedDoctor, setSignedDoctor] = useState<InteractionItem | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Create Event State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        category: '兴趣小组',
        date: '',
        loc: '',
        contact: '',
        description: '',
        max: 10
    });

    useEffect(() => {
        loadData();
    }, [activeSegment, eventSubTab]);

    // Poll for chat messages if user is on chat tab and has a signed doctor
    useEffect(() => {
        let interval: any;
        if (activeSegment === 'chat' && signedDoctor) {
            loadMessages();
            interval = setInterval(loadMessages, 3000);
        }
        return () => clearInterval(interval);
    }, [activeSegment, signedDoctor]);

    // Scroll to bottom
    useEffect(() => {
        if (activeSegment === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, activeSegment]);

    const loadData = async () => {
        // Fetch all events
        const allEvents = await fetchContent('event'); 
        // Fetch interactions
        const allInteractions = await fetchInteractions();
        
        setEvents(allEvents);
        setInteractions(allInteractions.filter(i => i.type === 'event_signup'));

        // Check for Signed Doctor
        const signing = allInteractions.find(i => i.type === 'signing' && i.userId === userId && i.status === 'confirmed');
        setSignedDoctor(signing || null);
    };

    const loadMessages = async () => {
        if (!signedDoctor) return;
        const msgs = await fetchMessages(userId, signedDoctor.targetId);
        setChatMessages(msgs);
    };

    const handleSendMsg = async () => {
        if (!signedDoctor || !chatInput.trim()) return;
        
        await sendMessage({
            senderId: userId,
            senderRole: 'user',
            receiverId: signedDoctor.targetId,
            content: chatInput
        });
        
        setChatInput('');
        loadMessages();
    };

    // --- Helpers ---
    
    const getLobbyEvents = () => events.filter(e => e.status === 'active');
    
    const getJoinedEvents = () => {
        const mySignups = interactions.filter(i => i.userId === userId);
        return mySignups.map(signup => {
            const evt = events.find(e => e.id === signup.targetId);
            return {
                ...signup,
                eventTitle: evt ? evt.title : '未知活动',
                eventLoc: evt ? evt.details?.loc : '',
                eventDate: evt ? evt.details?.date : '',
            };
        });
    };

    const getManagedEvents = () => events.filter(e => e.isUserUpload && e.author === '我');
    const getApplicants = (eventId: string) => interactions.filter(i => i.targetId === eventId);

    // --- Actions ---

    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.date || !newEvent.contact) {
            alert("请填写完整信息");
            return;
        }

        const item: ContentItem = {
            id: Date.now().toString(),
            type: 'event',
            title: newEvent.title,
            description: newEvent.description,
            tags: [newEvent.category, '用户发起'],
            image: '🎉',
            author: '我',
            isUserUpload: true,
            status: 'pending',
            updatedAt: new Date().toISOString(),
            details: {
                eventCategory: newEvent.category,
                date: newEvent.date,
                loc: newEvent.loc,
                contact: newEvent.contact,
                max: Number(newEvent.max),
                organizer: '用户发起',
                registered: 0
            }
        };

        await saveContent(item);
        setShowCreateModal(false);
        setNewEvent({ title: '', category: '兴趣小组', date: '', loc: '', contact: '', description: '', max: 10 });
        alert("活动申请已提交，请等待管理员审核上架！");
        loadData();
    };

    const handleJoinEvent = async (event: ContentItem) => {
        const existing = interactions.find(i => i.targetId === event.id && i.userId === userId);
        if (existing) return alert("您已报名该活动");

        const interaction: InteractionItem = {
            id: `signup_${Date.now()}`,
            type: 'event_signup',
            userId: userId,
            userName: CURRENT_USER_NAME,
            targetId: event.id,
            targetName: event.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: '用户自助报名'
        };

        await saveInteraction(interaction);
        alert("报名申请已发送，请等待发起人审核");
        loadData();
    };

    const handleAuditApplicant = async (interactionId: string, pass: boolean) => {
        await updateInteractionStatus(interactionId, pass ? 'confirmed' : 'cancelled');
        loadData();
    };

    const nextFollowUp = archive?.follow_up_schedule.find(s => s.status === 'pending');

    return (
        <div className="bg-slate-50 min-h-full flex flex-col h-full">
            {/* Segment Control */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-200 flex shrink-0">
                <button 
                    onClick={() => setActiveSegment('chat')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeSegment === 'chat' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}
                >
                    医生互动
                </button>
                <button 
                    onClick={() => setActiveSegment('event')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeSegment === 'event' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}
                >
                    社区活动
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeSegment === 'chat' && (
                    <div className="h-full flex flex-col p-4 pb-24">
                        {/* Notifications */}
                        <div className="mb-4 space-y-3">
                            {archive && (
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3">
                                    <div className="text-xl bg-teal-50 w-8 h-8 rounded flex items-center justify-center">📢</div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">健康档案更新</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            您的健康评估报告已生成 ({new Date(archive.updated_at || archive.created_at).toLocaleDateString()})
                                        </div>
                                    </div>
                                </div>
                            )}
                            {nextFollowUp && (
                                <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex items-start gap-3">
                                    <div className="text-xl bg-blue-50 w-8 h-8 rounded flex items-center justify-center">📅</div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">随访提醒</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            下次复查时间：{nextFollowUp.date} <br/>
                                            重点项目：{nextFollowUp.focusItems.join(', ')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {signedDoctor ? (
                            <>
                                {/* Chat Header */}
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-2xl">👨‍⚕️</div>
                                        <div>
                                            <h3 className="font-bold text-blue-800">{signedDoctor.targetName} 医生</h3>
                                            <p className="text-xs text-blue-600 mt-0.5">专属家庭医生 · 24h响应</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat History */}
                                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
                                    {chatMessages.length === 0 && (
                                        <div className="text-center text-xs text-slate-400 mt-10">暂无消息，向医生问个好吧~</div>
                                    )}
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                                                msg.senderRole === 'user' 
                                                ? 'bg-teal-600 text-white rounded-br-none' 
                                                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                            }`}>
                                                {msg.content}
                                                <div className={`text-[10px] mt-1 text-right ${msg.senderRole === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div className="flex gap-2 shrink-0">
                                    <input 
                                        className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                        placeholder="请输入咨询问题..."
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMsg()}
                                    />
                                    <button 
                                        onClick={handleSendMsg}
                                        className="bg-teal-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-teal-700 shadow-md active:scale-95 transition-transform"
                                    >
                                        ➤
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center pb-20">
                                <div className="text-6xl mb-4 opacity-50">👨‍⚕️</div>
                                <h3 className="text-lg font-bold text-slate-600">尚未签约家庭医生</h3>
                                <p className="text-sm mt-2 max-w-[200px]">请前往“寻医问药”板块查看医生并申请签约。</p>
                            </div>
                        )}
                    </div>
                )}

                {activeSegment === 'event' && (
                    <div className="p-4 space-y-4 pb-24">
                        {/* Event Sub-Navigation */}
                        <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
                            {([
                                {id: 'lobby', label: '活动大厅'},
                                {id: 'joined', label: '我的报名'},
                                {id: 'managed', label: '我发起的'}
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setEventSubTab(tab.id)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                        eventSubTab === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* 1. LOBBY VIEW */}
                        {eventSubTab === 'lobby' && (
                            <div className="space-y-4">
                                <div className="bg-teal-600 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h3 className="font-bold text-lg mb-1">健康生活，一起行动！</h3>
                                        <p className="text-xs opacity-90 mb-3">参加集体活动，赢取健康积分兑换好礼</p>
                                        <div className="flex gap-2">
                                            <button className="bg-white text-teal-700 px-3 py-1 rounded text-xs font-bold">查看积分商城</button>
                                            <button onClick={() => setShowCreateModal(true)} className="bg-teal-800 text-white px-3 py-1 rounded text-xs font-bold border border-teal-500 flex items-center gap-1">
                                                <span>+</span> 发起活动
                                            </button>
                                        </div>
                                    </div>
                                    <div className="absolute right-0 top-0 text-8xl opacity-20">🎉</div>
                                </div>

                                {getLobbyEvents().map(evt => {
                                    const mySignup = interactions.find(i => i.targetId === evt.id && i.userId === userId);
                                    const isAuthor = evt.isUserUpload && evt.author === '我';
                                    
                                    return (
                                        <div key={evt.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 group">
                                            <div className="h-32 bg-slate-100 relative flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-500">
                                                {evt.image}
                                                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                                                    {evt.tags?.[0] || '活动'}
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="font-bold text-slate-800 text-base">{evt.title}</h3>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                                    <span>📅 {evt.details?.date?.replace('T', ' ')}</span>
                                                    <span>📍 {evt.details?.loc}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{evt.description}</p>
                                                
                                                <div className="mt-4 flex justify-between items-center border-t border-slate-50 pt-3">
                                                    <div className="text-xs text-slate-500">
                                                        报名 <span className="font-bold text-teal-600">{getApplicants(evt.id).filter(a=>a.status==='confirmed').length}</span> / {evt.details?.max || '∞'}
                                                    </div>
                                                    
                                                    {isAuthor ? (
                                                        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">我发起的</span>
                                                    ) : mySignup ? (
                                                        <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                                                            mySignup.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                            mySignup.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {mySignup.status === 'pending' ? '审核中' : mySignup.status === 'confirmed' ? '已报名' : '已拒绝'}
                                                        </span>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleJoinEvent(evt)}
                                                            className="bg-teal-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow hover:bg-teal-700"
                                                        >
                                                            立即报名
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {getLobbyEvents().length === 0 && (
                                    <div className="text-center py-10 text-slate-400">暂无活动，快来发起第一个活动吧！</div>
                                )}
                            </div>
                        )}

                        {/* 2. JOINED VIEW */}
                        {eventSubTab === 'joined' && (
                            <div className="space-y-3">
                                {getJoinedEvents().map(signup => (
                                    <div key={signup.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-1">{signup.eventTitle}</h4>
                                            <div className="text-xs text-slate-500 space-y-0.5">
                                                <div>📅 {signup.eventDate?.replace('T', ' ')}</div>
                                                <div>📍 {signup.eventLoc}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                                signup.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                signup.status === 'confirmed' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                'bg-red-50 text-red-600 border border-red-100'
                                            }`}>
                                                {signup.status === 'pending' ? '等待审核' : signup.status === 'confirmed' ? '报名成功' : '申请被拒'}
                                            </span>
                                            <div className="text-[10px] text-slate-400 mt-1">{signup.date} 申请</div>
                                        </div>
                                    </div>
                                ))}
                                {getJoinedEvents().length === 0 && (
                                    <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                                        <span className="text-4xl mb-2">🎫</span>
                                        暂无报名记录
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. MANAGED VIEW */}
                        {eventSubTab === 'managed' && (
                            <div className="space-y-4">
                                {getManagedEvents().map(evt => {
                                    const applicants = getApplicants(evt.id);
                                    const pendingApplicants = applicants.filter(a => a.status === 'pending');
                                    
                                    return (
                                        <div key={evt.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
                                                <div className="font-bold text-slate-800 text-sm">{evt.title}</div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                    evt.status === 'active' ? 'bg-green-100 text-green-700' : 
                                                    evt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {evt.status === 'active' ? '已上架' : evt.status === 'pending' ? '等待平台审核' : '已下架'}
                                                </span>
                                            </div>
                                            
                                            <div className="p-4">
                                                <div className="text-xs text-slate-500 mb-3">
                                                    <div>活动时间: {evt.details?.date?.replace('T', ' ')}</div>
                                                    <div>已报名: {applicants.filter(a => a.status === 'confirmed').length} 人</div>
                                                </div>

                                                {/* Applicant Audit Area */}
                                                {pendingApplicants.length > 0 ? (
                                                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                                        <div className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1">
                                                            <span>🔔</span> 待审核报名 ({pendingApplicants.length})
                                                        </div>
                                                        <div className="space-y-2">
                                                            {pendingApplicants.map(app => (
                                                                <div key={app.id} className="bg-white p-2 rounded border border-orange-100 flex justify-between items-center">
                                                                    <span className="text-xs font-bold text-slate-700">{app.userName}</span>
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            onClick={() => handleAuditApplicant(app.id, false)}
                                                                            className="text-[10px] text-red-500 border border-red-200 px-2 py-0.5 rounded hover:bg-red-50"
                                                                        >
                                                                            拒绝
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleAuditApplicant(app.id, true)}
                                                                            className="text-[10px] text-white bg-green-500 px-2 py-0.5 rounded hover:bg-green-600"
                                                                        >
                                                                            通过
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-400 py-2 bg-slate-50 rounded border border-dashed border-slate-200">
                                                        暂无新的报名申请
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {getManagedEvents().length === 0 && (
                                    <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                                        <span className="text-4xl mb-2">📝</span>
                                        您还没有发起过活动
                                        <button onClick={() => setShowCreateModal(true)} className="mt-2 text-teal-600 text-sm font-bold hover:underline">立即发起</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scaleIn shadow-2xl">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-slate-800">发起社区活动</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 text-xl font-bold">×</button>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">活动主题</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="例如：周末晨跑、羽毛球约局"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">类型</label>
                                    <select 
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white"
                                        value={newEvent.category}
                                        onChange={e => setNewEvent({...newEvent, category: e.target.value})}
                                    >
                                        <option>兴趣小组</option>
                                        <option>运动打卡</option>
                                        <option>知识分享</option>
                                        <option>互助交流</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">人数上限</label>
                                    <input 
                                        type="number"
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                                        value={newEvent.max}
                                        onChange={e => setNewEvent({...newEvent, max: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">时间</label>
                                <input 
                                    type="datetime-local"
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                                    value={newEvent.date}
                                    onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">地点</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                                    placeholder="集合地点"
                                    value={newEvent.loc}
                                    onChange={e => setNewEvent({...newEvent, loc: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">联系方式 (微信号/手机)</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm"
                                    placeholder="方便大家联系您"
                                    value={newEvent.contact}
                                    onChange={e => setNewEvent({...newEvent, contact: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">活动详情</label>
                                <textarea 
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm h-20 resize-none"
                                    placeholder="介绍一下活动内容..."
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium text-sm">取消</button>
                            <button onClick={handleCreateEvent} className="flex-1 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 text-sm shadow-md">提交申请</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
