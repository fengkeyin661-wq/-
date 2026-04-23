
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Shared Interfaces
export interface ContentItem {
  id: string;
  type: 'meal' | 'exercise' | 'article' | 'event' | 'drug' | 'doctor' | 'service' | 'circle';
  title: string;
  description?: string;
  tags: string[];
  image?: string;
  author?: string;
  isUserUpload?: boolean;
  details?: { [key: string]: any; };
  status: 'active' | 'pending' | 'rejected';
  updatedAt: string;
}

/** 资源运营台「医生」条目中标记为健康管家，供医生站指派、用户端展示 */
export const isHealthManagerContent = (item: ContentItem): boolean => {
  if (item.type !== 'doctor') return false;
  if (item.details?.role === 'health_manager') return true;
  return (item.tags || []).some((t) => String(t).includes('健康管家'));
};

/** 统一解析「医院总台」账号（唯一会话对象） */
export const pickDeskManager = (doctors: ContentItem[], preferredId?: string | null): ContentItem | null => {
    if (!doctors.length) return null;
    const doctorRows = doctors.filter((d) => d.type === 'doctor');
    if (!doctorRows.length) return null;
    if (preferredId) {
        const matched = doctorRows.find((d) => d.id === preferredId);
        if (matched) return matched;
    }
    return (
        doctorRows.find((d) => d.title.includes('小郑')) ||
        doctorRows.find((d) => isHealthManagerContent(d)) ||
        doctorRows[0] ||
        null
    );
};

export interface InteractionItem {
    id: string;
    // Updated types: 
    // doctor_signing (签约), doctor_booking (挂号), drug_order (药品) -> 医生审核
    // event_signup (活动), circle_join (圈子), service_booking (服务) -> 管理员审核
    type:
        | 'doctor_signing'
        | 'doctor_booking'
        | 'manager_recommend_doctor'
        | 'manager_recommend_resource'
        | 'drug_order'
        | 'event_signup'
        | 'circle_join'
        | 'service_booking'
        | 'check_result_upload';
    userId: string;
    userName: string;
    targetId: string;
    targetName: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    date: string;
    details?: string;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderRole: 'user' | 'doctor' | 'manager';
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
    messageType?: 'text' | 'image' | 'card_recommend';
    mediaUrl?: string;
    thumbUrl?: string;
    metadata?: { [key: string]: any };
}

export interface DeskInboxSummary {
    userId: string;
    unread: number;
    lastMessage?: ChatMessage;
}

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V4';
const INTERACTION_KEY = 'HEALTH_GUARD_INTERACTIONS_V1';
const CHAT_KEY = 'HEALTH_GUARD_CHATS_V1';
const CHAT_TABLE = 'app_chat_messages';
const CHAT_RETENTION_DAYS = 90;
const CHAT_CLEANUP_STAMP_KEY = 'HEALTH_GUARD_CHAT_CLEANUP_TS';

const getRetentionCutoffIso = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - CHAT_RETENTION_DAYS);
    return d.toISOString();
};

const shouldRunCleanupNow = (): boolean => {
    const raw = localStorage.getItem(CHAT_CLEANUP_STAMP_KEY);
    if (!raw) return true;
    const ts = Number(raw);
    if (!ts) return true;
    return Date.now() - ts > 24 * 60 * 60 * 1000;
};

export const pruneOldMessages = async (): Promise<void> => {
    if (!shouldRunCleanupNow()) return;
    const cutoffIso = getRetentionCutoffIso();
    try {
        const raw = localStorage.getItem(CHAT_KEY);
        if (raw) {
            const all: ChatMessage[] = JSON.parse(raw);
            const kept = all.filter((m) => new Date(m.timestamp).toISOString() >= cutoffIso);
            if (kept.length !== all.length) {
                localStorage.setItem(CHAT_KEY, JSON.stringify(kept));
            }
        }
    } catch (e) {
        console.warn('Local chat cleanup failed', e);
    }
    if (isSupabaseConfigured()) {
        try {
            await supabase.from(CHAT_TABLE).delete().lt('timestamp', cutoffIso);
        } catch (e) {
            console.warn('Cloud chat cleanup failed', e);
        }
    }
    localStorage.setItem(CHAT_CLEANUP_STAMP_KEY, String(Date.now()));
};

// --- Diagnostic Tool ---
export const checkDbConnection = async (): Promise<{
    status: 'connected' | 'local_only' | 'error' | 'empty_but_local_has_data';
    message: string;
    details?: string;
}> => {
    if (!isSupabaseConfigured()) {
        return {
            status: 'local_only',
            message:
                '未配置云数据库，仅使用本地存储（Vite 需在构建时注入 VITE_SUPABASE_URL 与 VITE_SUPABASE_KEY 或 VITE_SUPABASE_ANON_KEY；Vercel 改变量后请 Redeploy）',
        };
    }

    try {
        // Test Read
        const { data, error, count } = await supabase.from('app_content').select('id', { count: 'exact', head: false }).limit(1);
        
        if (error) {
            return { status: 'error', message: '数据库连接失败 (Read)', details: error.message };
        }

        // Check if DB is empty but Local is not (Potential RLS or Sync issue)
        const localDataRaw = localStorage.getItem(STORAGE_KEY);
        const localData = localDataRaw ? JSON.parse(localDataRaw) : [];
        
        if ((!data || data.length === 0) && localData.length > 0) {
            return { 
                status: 'empty_but_local_has_data', 
                message: '云端无数据，但本地有数据', 
                details: '可能是 RLS 策略阻止了读取，或者表是空的。建议执行 SQL 初始化脚本。' 
            };
        }

        return { status: 'connected', message: '云数据库连接正常' };
    } catch (e: any) {
        return { status: 'error', message: '连接异常', details: e.message };
    }
};

// 1. Content (Resources)
export const fetchContent = async (type?: string | string[], status?: 'active' | 'pending'): Promise<ContentItem[]> => {
  let dbData: ContentItem[] | null = null;
  let useLocal = true;

  if (isSupabaseConfigured()) {
      try {
          let query = supabase.from('app_content').select('*');
          if (type) {
              if (Array.isArray(type)) query = query.in('type', type);
              else query = query.eq('type', type);
          }
          if (status) query = query.eq('status', status);
          const { data, error } = await query.order('updated_at', { ascending: false });
          
          if (!error && data) {
              dbData = data.map((d:any) => ({ 
                  ...d, 
                  updatedAt: d.updated_at, 
                  isUserUpload: d.is_user_upload,
                  // Compat: Read description from details if root column missing/empty
                  description: d.description || d.details?.description || ''
              }));
              useLocal = false; 
          } else {
              console.warn("Supabase fetch failed or empty, falling back to local.", error);
          }
      } catch (e) {
          console.warn("Supabase exception, falling back to local.", e);
      }
  }

  if (useLocal) {
      // Fallback
      await new Promise(r => setTimeout(r, 50));
      const raw = localStorage.getItem(STORAGE_KEY);
      let all: ContentItem[] = raw ? JSON.parse(raw) : [];
      if (type) {
          if (Array.isArray(type)) all = all.filter(i => type.includes(i.type));
          else all = all.filter(i => i.type === type);
      }
      if (status !== undefined) all = all.filter(i => i.status === status);
      return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  return dbData || [];
};

export const saveContent = async (item: ContentItem): Promise<{success: boolean, mode: 'cloud' | 'local', error?: string}> => {
  // 1. Always save Local
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = { ...item, updatedAt: new Date().toISOString() };
  else all.push({ ...item, updatedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  // 2. Try DB
  if (isSupabaseConfigured()) {
      try {
          const packedDetails = {
              ...item.details,
              description: item.description 
          };

          const payload = {
              id: item.id, 
              type: item.type, 
              title: item.title, 
              tags: item.tags, 
              image: item.image, 
              author: item.author, 
              is_user_upload: item.isUserUpload,
              details: packedDetails, 
              status: item.status, 
              updated_at: new Date().toISOString()
          };
          
          const { error } = await supabase.from('app_content').upsert(payload);
          
          if (error) {
              console.error("Supabase Write Failed:", error.message);
              return { success: true, mode: 'local', error: `云端同步失败: ${error.message} (已保存到本地)` };
          }
          return { success: true, mode: 'cloud' };
      } catch (e: any) {
          console.error("Supabase Exception:", e);
          return { success: true, mode: 'local', error: `云端连接异常: ${e.message}` };
      }
  }
  return { success: true, mode: 'local' };
};

export const deleteContent = async (id: string): Promise<boolean> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(i => i.id !== id)));

  if (isSupabaseConfigured()) {
      try {
        await supabase.from('app_content').delete().eq('id', id);
      } catch(e) { console.warn("DB delete failed", e); }
  }
  return true;
};

// 2. Interactions (Signups, Bookings, etc.)
export const fetchInteractions = async (type?: string): Promise<InteractionItem[]> => {
    let dbData: InteractionItem[] | null = null;
    let useLocal = true;

    // Try Supabase First
    if (isSupabaseConfigured()) {
        try {
            let query = supabase.from('app_interactions').select('*');
            if (type) query = query.eq('type', type);
            
            const { data, error } = await query;
            if (!error && data) {
                // Map DB snake_case to camelCase
                dbData = data.map((d: any) => ({
                    id: d.id,
                    type: d.type,
                    userId: d.user_id,
                    userName: d.user_name,
                    targetId: d.target_id,
                    targetName: d.target_name,
                    status: d.status,
                    date: d.date,
                    details: d.details
                }));
                useLocal = false;
            }
        } catch (e) {
            console.warn("Fetch interactions DB failed", e);
        }
    }

    if (useLocal) {
        const raw = localStorage.getItem(INTERACTION_KEY);
        let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
        if (type) all = all.filter(i => i.type === type);
        return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return (dbData || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const saveInteraction = async (item: InteractionItem): Promise<boolean> => {
    // 1. Local Save (Optimistic check)
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];

    // [DUPLICATION CHECK - LOCAL]
    if (item.type === 'doctor_signing' || item.type === 'circle_join') {
        const existingIdx = all.findIndex(i => 
            i.type === item.type && 
            i.userId === item.userId && 
            i.targetId === item.targetId &&
            i.status !== 'cancelled'
        );

        if (existingIdx >= 0) {
            const existing = all[existingIdx];
            if (existing.status === 'confirmed') return true; 
            if (existing.status === 'pending') {
                // Update existing pending request locally
                all[existingIdx] = { ...existing, date: item.date, details: item.details }; 
                // We do NOT update ID here to avoid breaking local references, but for DB sync we need care
                localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
            }
        } else {
            all.push(item);
            localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
        }
    } else {
        all.push(item);
        localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
    }

    // 2. Cloud Save (Smart Merge)
    if (isSupabaseConfigured()) {
        try {
            let itemIdToUse = item.id;

            // Strict deduplication check for cloud to merge repeated applications
            if (item.type === 'doctor_signing' || item.type === 'circle_join') {
                const { data: existingRows } = await supabase
                    .from('app_interactions')
                    .select('id, status')
                    .eq('user_id', item.userId)
                    .eq('target_id', item.targetId)
                    .eq('type', item.type)
                    .neq('status', 'cancelled'); // Ignore cancelled ones, treat as new

                if (existingRows && existingRows.length > 0) {
                    const activeRow = existingRows[0];
                    if (activeRow.status === 'confirmed') {
                        return true; // Already confirmed, skip
                    }
                    // If pending, reuse the ID to perform an update instead of insert
                    itemIdToUse = activeRow.id;
                }
            }

            const payload = {
                id: itemIdToUse,
                type: item.type,
                user_id: item.userId,
                user_name: item.userName,
                target_id: item.targetId,
                target_name: item.targetName,
                status: item.status,
                date: item.date,
                details: item.details
            };
            const { error } = await supabase.from('app_interactions').upsert(payload);
            if (error) console.error("DB Save Interaction Error", error);
        } catch (e) {
            console.error("DB Save Interaction Exception", e);
        }
    }
    return true;
};

export const updateInteractionStatus = async (id: string, status: InteractionItem['status']): Promise<boolean> => {
    // 1. Local Update
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(i => i.id === id);
    if (idx >= 0) { 
        all[idx].status = status; 
        localStorage.setItem(INTERACTION_KEY, JSON.stringify(all)); 
    }

    // 2. Cloud Update
    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase.from('app_interactions').update({ status }).eq('id', id);
            if (error) console.error("DB Update Interaction Error", error);
        } catch (e) {
            console.error("DB Update Interaction Exception", e);
        }
    }
    
    return true;
};

// 3. Chat Messages
export const fetchMessages = async (userId: string, doctorId: string): Promise<ChatMessage[]> => {
    await pruneOldMessages();
    if (isSupabaseConfigured()) {
        try {
            const conversationFilter = `and(sender_id.eq.${userId},receiver_id.eq.${doctorId}),and(sender_id.eq.${doctorId},receiver_id.eq.${userId})`;
            const fullColumns = 'id, sender_id, sender_role, receiver_id, content, timestamp, read, message_type, media_url, thumb_url, metadata';
            let { data, error } = await supabase
                .from(CHAT_TABLE)
                .select(fullColumns)
                .or(conversationFilter)
                .order('timestamp', { ascending: true });

            // Backward compatibility: some environments may not have all extended columns.
            if (error) {
                const fallback = await supabase
                    .from(CHAT_TABLE)
                    .select('id, sender_id, sender_role, receiver_id, content, timestamp, read')
                    .or(conversationFilter)
                    .order('timestamp', { ascending: true });
                data = fallback.data as any;
                error = fallback.error as any;
            }

            if (!error && data) {
                const cloudMsgs: ChatMessage[] = data.map((row: any) => ({
                    id: row.id,
                    senderId: row.sender_id,
                    senderRole: row.sender_role,
                    receiverId: row.receiver_id,
                    content: row.content,
                    timestamp: row.timestamp,
                    read: !!row.read,
                    messageType: row.message_type || 'text',
                    mediaUrl: row.media_url || undefined,
                    thumbUrl: row.thumb_url || undefined,
                    metadata: row.metadata || undefined,
                }));
                // Keep local cache warm for offline fallback.
                localStorage.setItem(CHAT_KEY, JSON.stringify(cloudMsgs));
                return cloudMsgs;
            }
            console.warn('Fetch chat from cloud failed, fallback to local:', error?.message);
        } catch (e) {
            console.warn('Fetch chat from cloud exception, fallback to local:', e);
        }
    }

    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    return all.filter(m => (m.senderId === userId && m.receiverId === doctorId) || (m.senderId === doctorId && m.receiverId === userId)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
export const sendMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>): Promise<ChatMessage> => {
    await pruneOldMessages();
    const messageId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newMsg: ChatMessage = {
        ...msg,
        id: messageId,
        timestamp: new Date().toISOString(),
        read: false,
        messageType: msg.messageType || 'text',
    };
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    all.push(newMsg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));

    if (isSupabaseConfigured()) {
        try {
            const fullPayload = {
                id: newMsg.id,
                sender_id: newMsg.senderId,
                sender_role: newMsg.senderRole,
                receiver_id: newMsg.receiverId,
                content: newMsg.content,
                timestamp: newMsg.timestamp,
                read: newMsg.read,
                message_type: newMsg.messageType || 'text',
                media_url: newMsg.mediaUrl || null,
                thumb_url: newMsg.thumbUrl || null,
                metadata: newMsg.metadata || null,
            };
            let { error } = await supabase.from(CHAT_TABLE).upsert(fullPayload);
            if (error) {
                const basicPayload = {
                    id: newMsg.id,
                    sender_id: newMsg.senderId,
                    sender_role: newMsg.senderRole,
                    receiver_id: newMsg.receiverId,
                    content: newMsg.content,
                    timestamp: newMsg.timestamp,
                    read: newMsg.read,
                };
                const fallback = await supabase.from(CHAT_TABLE).upsert(basicPayload);
                error = fallback.error as any;
            }
            if (error) {
                console.error('Cloud sendMessage failed, message kept locally:', error.message || error);
            }
        } catch (e) {
            console.error('Cloud sendMessage exception, message kept locally:', e);
        }
    }

    return newMsg;
};

export const getUnreadCount = async (receiverId: string, senderId?: string): Promise<number> => {
    if (isSupabaseConfigured()) {
        try {
            let query = supabase
                .from(CHAT_TABLE)
                .select('id', { count: 'exact', head: true })
                .eq('receiver_id', receiverId)
                .eq('read', false);
            if (senderId) query = query.eq('sender_id', senderId);
            const { count, error } = await query;
            if (!error) return count || 0;
            console.warn('Cloud getUnreadCount failed, fallback to local:', error.message);
        } catch (e) {
            console.warn('Cloud getUnreadCount exception, fallback to local:', e);
        }
    }

    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    
    return all.filter(m => {
        const isRecipient = m.receiverId === receiverId;
        const isUnread = m.read === false;
        const isSenderMatch = senderId ? m.senderId === senderId : true;
        return isRecipient && isUnread && isSenderMatch;
    }).length;
};

export const markAsRead = async (receiverId: string, senderId: string): Promise<void> => {
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    
    let changed = false;
    all = all.map(m => {
        if (m.receiverId === receiverId && m.senderId === senderId && !m.read) {
            changed = true;
            return { ...m, read: true };
        }
        return m;
    });

    if (changed) {
        localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    }

    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase
                .from(CHAT_TABLE)
                .update({ read: true })
                .eq('receiver_id', receiverId)
                .eq('sender_id', senderId)
                .eq('read', false);
            if (error) {
                console.warn('Cloud markAsRead failed, local updated only:', error.message);
            }
        } catch (e) {
            console.warn('Cloud markAsRead exception, local updated only:', e);
        }
    }
};

/** 运营台总台收件箱：聚合每个用户对总台的未读与最新消息 */
export const getDeskInboxSummaries = async (deskManagerId: string, userIds: string[]): Promise<DeskInboxSummary[]> => {
    if (!deskManagerId || !userIds.length) return [];
    const summaries = await Promise.all(
        userIds.map(async (userId) => {
            const [unread, messages] = await Promise.all([
                getUnreadCount(deskManagerId, userId),
                fetchMessages(userId, deskManagerId),
            ]);
            return {
                userId,
                unread,
                lastMessage: messages[messages.length - 1],
            } as DeskInboxSummary;
        })
    );
    return summaries.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.unread - a.unread;
    });
};

// --- Seed Data ---
export const seedInitialData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialData: ContentItem[] = [
            { 
                id: 'm1', type: 'meal', title: '地中海风味烤鱼', image: '🐟', tags: ['低脂', '高蛋白'], author: '营养科', status: 'active', updatedAt: new Date().toISOString(), 
                description: '富含Omega-3脂肪酸的健康午餐',
                details: { 
                    ingredients: '海鲈鱼 200g, 柠檬 1个, 迷迭香 2枝, 橄榄油 10ml, 黑胡椒 适量',
                    steps: '1. 鱼洗净擦干; 2. 涂抹橄榄油盐黑胡椒; 3. 放上柠檬迷迭香; 4. 烤箱200度20分钟',
                    cookingTime: '30分钟',
                    difficulty: '中等',
                    nutrition: '热量:350kcal, 蛋白质:30g, 脂肪:15g',
                    cal: 350,
                    macros: { protein: 30, fat: 15, carbs: 5, fiber: 1 }
                } 
            }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
