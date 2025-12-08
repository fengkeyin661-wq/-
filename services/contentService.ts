
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Shared Interfaces
export interface ContentItem {
  id: string;
  type: 'meal' | 'exercise' | 'article' | 'event' | 'drug' | 'doctor' | 'service';
  title: string;
  description?: string;
  tags: string[];
  image?: string;
  author?: string;
  isUserUpload?: boolean;
  
  // Detailed Content Fields (Flexible JSON)
  details?: {
    [key: string]: any; // Allow flexible structure for compatibility
    
    // Specific fields for typing assistance
    ingredients?: string;
    steps?: string;
    nutrition?: string;
    cal?: string;
    cookingTime?: string;
    difficulty?: string;
    
    exerciseType?: string;
    frequency?: string;
    intensity?: string;
    duration?: string;
    calories?: string;
    prepWork?: string;
    contraindications?: string;
    content?: string;

    serviceCategory?: '检查' | '检验' | '治疗';
    dept?: string;
    price?: string;
    clinicalSignificance?: string;
    targetAudience?: string;
    preCheckPrep?: string;
    
    usage?: string;
    dosage?: string;
    adminRoute?: string;
    timingNotes?: string;
    sideEffects?: string;
    drugContraindications?: string;
    interactions?: string;
    storage?: string;
    missedDose?: string;
    stock?: string; 
    spec?: string;

    specialty?: string;
    hospital?: string;
    schedule?: string;
    username?: string;
    password?: string;
    
    eventCategory?: string;
    date?: string;
    deadline?: string;
    loc?: string;
    organizer?: string;
    contact?: string;
    max?: number;
    registered?: number;
  };
  
  status: 'active' | 'pending' | 'rejected';
  updatedAt: string;
}

export interface InteractionItem {
    id: string;
    type: 'booking' | 'drug_order' | 'signing' | 'event_signup';
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

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V3';
const INTERACTION_KEY = 'HEALTH_GUARD_INTERACTIONS_V1';
const CHAT_KEY = 'HEALTH_GUARD_CHATS_V1';

// --- Hybrid Data Access (Supabase First -> LocalStorage Fallback) ---

// 1. Content (Resources)
export const fetchContent = async (type?: string | string[], status?: 'active' | 'pending'): Promise<ContentItem[]> => {
  // Try Supabase
  if (isSupabaseConfigured()) {
      try {
          let query = supabase.from('app_content').select('*');
          
          if (type) {
              if (Array.isArray(type)) query = query.in('type', type);
              else query = query.eq('type', type);
          }
          if (status) {
              query = query.eq('status', status);
          }
          
          const { data, error } = await query.order('updated_at', { ascending: false });
          if (!error && data) return data.map(d => ({ ...d, updatedAt: d.updated_at, isUserUpload: d.is_user_upload })); 
      } catch (e) {
          console.warn("Supabase fetch content failed, falling back to local", e);
      }
  }

  // Fallback Local
  await new Promise(r => setTimeout(r, 50));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  
  if (type) {
      if (Array.isArray(type)) all = all.filter(i => type.includes(i.type));
      else all = all.filter(i => i.type === type);
  }
  if (status !== undefined) {
      all = all.filter(i => i.status === status);
  }
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const fetchAllContent = async (): Promise<ContentItem[]> => {
    return fetchContent(); // Re-use logic
}

export const saveContent = async (item: ContentItem): Promise<boolean> => {
  // Try Supabase
  if (isSupabaseConfigured()) {
      try {
          const payload = {
              id: item.id,
              type: item.type,
              title: item.title,
              description: item.description,
              tags: item.tags,
              image: item.image,
              author: item.author,
              is_user_upload: item.isUserUpload,
              details: item.details,
              status: item.status,
              updated_at: new Date().toISOString()
          };
          const { error } = await supabase.from('app_content').upsert(payload);
          if (!error) return true;
      } catch (e) {
          console.warn("Supabase save content failed", e);
      }
  }

  // Fallback Local
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = { ...item, updatedAt: new Date().toISOString() };
  else all.push({ ...item, updatedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return true;
};

export const deleteContent = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured()) {
      const { error } = await supabase.from('app_content').delete().eq('id', id);
      if (!error) return true;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(i => i.id !== id)));
  return true;
};

// 2. Interactions (Signings, Bookings)
export const fetchInteractions = async (type?: string): Promise<InteractionItem[]> => {
    if (isSupabaseConfigured()) {
        try {
            let query = supabase.from('app_interactions').select('*');
            if (type) query = query.eq('type', type);
            const { data, error } = await query.order('date', { ascending: false });
            // Map db columns if necessary (snake_case to camelCase usually handled by JS/TS if names match, but manual mapping is safer if schema differs)
            if (!error && data) return data.map(d => ({
                id: d.id, type: d.type, userId: d.user_id, userName: d.user_name,
                targetId: d.target_id, targetName: d.target_name, status: d.status, date: d.date, details: d.details
            }));
        } catch (e) {}
    }

    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    if (type) all = all.filter(i => i.type === type);
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const saveInteraction = async (item: InteractionItem): Promise<boolean> => {
    if (isSupabaseConfigured()) {
        const payload = {
            id: item.id, type: item.type, user_id: item.userId, user_name: item.userName,
            target_id: item.targetId, target_name: item.targetName, status: item.status, date: item.date, details: item.details
        };
        const { error } = await supabase.from('app_interactions').upsert(payload);
        if (!error) return true;
    }

    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    all.push(item);
    localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
    return true;
};

export const updateInteractionStatus = async (id: string, status: InteractionItem['status']): Promise<boolean> => {
    if (isSupabaseConfigured()) {
        const { error } = await supabase.from('app_interactions').update({ status }).eq('id', id);
        if (!error) return true;
    }

    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(i => i.id === id);
    if (idx >= 0) {
        all[idx].status = status;
        localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
        return true;
    }
    return false;
};

// 3. Messages (Chat)
export const fetchMessages = async (userId: string, doctorId: string): Promise<ChatMessage[]> => {
    if (isSupabaseConfigured()) {
        try {
            // Fetch messages where (sender=user AND receiver=doc) OR (sender=doc AND receiver=user)
            const { data, error } = await supabase.from('app_messages')
                .select('*')
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${doctorId}),and(sender_id.eq.${doctorId},receiver_id.eq.${userId})`)
                .order('timestamp', { ascending: true });
                
            if (!error && data) return data.map(d => ({
                id: d.id, senderId: d.sender_id, senderRole: d.sender_role, receiverId: d.receiver_id,
                content: d.content, timestamp: d.timestamp, read: d.read
            }));
        } catch (e) {}
    }

    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    return all.filter(m => 
        (m.senderId === userId && m.receiverId === doctorId) || 
        (m.senderId === doctorId && m.receiverId === userId)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const sendMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>): Promise<ChatMessage> => {
    const newMsg: ChatMessage = {
        ...msg,
        id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        read: false
    };

    if (isSupabaseConfigured()) {
        const payload = {
            id: newMsg.id, sender_id: newMsg.senderId, sender_role: newMsg.senderRole,
            receiver_id: newMsg.receiverId, content: newMsg.content, timestamp: newMsg.timestamp, read: false
        };
        const { error } = await supabase.from('app_messages').insert(payload);
        if (!error) return newMsg;
    }

    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    all.push(newMsg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    return newMsg;
};

// --- Seeding (Simplified for Local) ---
export const seedInitialData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialData: ContentItem[] = [
            { id: 'm1', type: 'meal', title: 'DASH降压午餐', image: '🍱', tags: ['高血压', '减重'], author: '营养科', status: 'active', updatedAt: new Date().toISOString(), description: '低钠高钾餐', details: { cal: '550', ingredients: '糙米, 鲈鱼' } },
            { id: 'e1', type: 'exercise', title: '八段锦跟练', image: '🧘', tags: ['康复'], author: '中医科', status: 'active', updatedAt: new Date().toISOString(), details: { duration: '15min', difficulty: '低' } },
            { id: 'd1', type: 'drug', title: '阿司匹林肠溶片', image: '💊', tags: ['心血管'], status: 'active', updatedAt: new Date().toISOString(), details: { stock: '500', spec: '100mg*30片', price: '12.5', usage: '抗血栓' } },
            { id: 's1', type: 'service', title: '核磁共振(MRI)', image: '🩻', tags: ['检查'], status: 'active', updatedAt: new Date().toISOString(), details: { price: '600', dept: '放射科' } },
            { id: 'doc1', type: 'doctor', title: '张主任', image: '👨‍⚕️', tags: ['心内科'], status: 'active', updatedAt: new Date().toISOString(), details: { dept: '心血管内科', title: '主任医师', specialty: '高血压, 冠心病', username: 'doc_zhang', password: '123' } },
            { id: 'ev1', type: 'event', title: '春季健步走', image: '🚶', tags: ['活动'], status: 'active', updatedAt: new Date().toISOString(), details: { date: '2024-06-01T09:00', deadline: '2024-05-30T18:00', max: 50, registered: 12, loc: '体育场' } },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
