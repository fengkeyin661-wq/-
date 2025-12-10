
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

export interface InteractionItem {
    id: string;
    // Updated types: 
    // doctor_signing (签约), doctor_booking (挂号), drug_order (药品) -> 医生审核
    // event_signup (活动), circle_join (圈子), service_booking (服务) -> 管理员审核
    type: 'doctor_signing' | 'doctor_booking' | 'drug_order' | 'event_signup' | 'circle_join' | 'service_booking';
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
    senderRole: 'user' | 'doctor';
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
}

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V4';
const INTERACTION_KEY = 'HEALTH_GUARD_INTERACTIONS_V1';
const CHAT_KEY = 'HEALTH_GUARD_CHATS_V1';

// --- Diagnostic Tool ---
export const checkDbConnection = async (): Promise<{
    status: 'connected' | 'local_only' | 'error' | 'empty_but_local_has_data';
    message: string;
    details?: string;
}> => {
    if (!isSupabaseConfigured()) {
        return { status: 'local_only', message: '未配置云数据库，仅使用本地存储' };
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

// ... (Interaction functions kept simple) ...
export const fetchInteractions = async (type?: string): Promise<InteractionItem[]> => {
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    if (type) all = all.filter(i => i.type === type);
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
export const saveInteraction = async (item: InteractionItem): Promise<boolean> => {
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    all.push(item);
    localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
    return true;
};
export const updateInteractionStatus = async (id: string, status: InteractionItem['status']): Promise<boolean> => {
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(i => i.id === id);
    if (idx >= 0) { all[idx].status = status; localStorage.setItem(INTERACTION_KEY, JSON.stringify(all)); return true; }
    return false;
};
export const fetchMessages = async (userId: string, doctorId: string): Promise<ChatMessage[]> => {
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    return all.filter(m => (m.senderId === userId && m.receiverId === doctorId) || (m.senderId === doctorId && m.receiverId === userId)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
export const sendMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>): Promise<ChatMessage> => {
    const newMsg: ChatMessage = { ...msg, id: `msg_${Date.now()}`, timestamp: new Date().toISOString(), read: false };
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    all.push(newMsg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    return newMsg;
};

// --- New Messaging Helpers ---

export const getUnreadCount = async (receiverId: string, senderId?: string): Promise<number> => {
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
                    nutrition: '热量:350kcal, 蛋白质:30g, 脂肪:15g'
                } 
            },
            // ... (Rest of seed data)
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
