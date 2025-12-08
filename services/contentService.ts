
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Shared Interfaces
export interface ContentItem {
  id: string;
  type: 'meal' | 'exercise' | 'article' | 'event' | 'drug' | 'doctor' | 'service';
  title: string;
  description?: string; // 用于通用描述或备注
  tags: string[];
  image?: string;
  author?: string;
  isUserUpload?: boolean;
  
  // Detailed Content Fields (Flexible JSON)
  details?: {
    [key: string]: any; 
    
    // --- 膳食库 (Meal) ---
    ingredients?: string;    // 配料及用量
    steps?: string;          // 详细制作步骤
    cookingTime?: string;    // 制作时长
    difficulty?: string;     // 难度
    nutrition?: string;      // 营养成分估算 (AI计算)
    cal?: string;            // 热量 (保留用于兼容显示)

    // --- 运动方案 (Exercise) ---
    exerciseType?: string;   // 运动类型
    frequency?: string;      // 频率
    intensity?: string;      // 强度
    duration?: string;       // 持续时间
    calories?: string;       // 消耗热量
    prepWork?: string;       // 准备工作
    contraindications?: string; // 注意事项/禁忌

    // --- 社区活动 (Event) ---
    eventCategory?: string;  // 类别
    date?: string;           // 时间 (精确到分)
    loc?: string;            // 地点
    registered?: number;     // 报名人数
    max?: number;            // 人数上限 (虽未明确提及但通常需要)
    organizer?: string;      // 组织者
    contact?: string;        // 联系方式
    deadline?: string;       // 报名截止日期

    // --- 医院服务 (Service) ---
    serviceCategory?: string;// 类别
    dept?: string;           // 所属科室
    price?: string;          // 单价
    clinicalSignificance?: string; // 检查意义
    targetAudience?: string; // 适用人群
    preCheckPrep?: string;   // 检查须知

    // --- 药品库 (Drug) ---
    spec?: string;           // 规格
    usage?: string;          // 用途/适应症
    dosage?: string;         // 用法用量
    adminRoute?: string;     // 给药途径
    timingNotes?: string;    // 服用时间与注意事项
    sideEffects?: string;    // 可能的副作用和不良反应
    drugContraindications?: string; // 禁忌症
    interactions?: string;   // 药物相互作用
    storage?: string;        // 储存与有效期
    missedDose?: string;     // 漏服处理
    stock?: string;          // 库存状态 (保留)

    // --- 医生 (Doctor) ---
    // dept (复用)
    title?: string;          // 职称
    specialty?: string;      // 擅长领域
    schedule?: string;       // 门诊时间
    hospital?: string;       // 医院
    username?: string;       // 签约平台账号
    password?: string;       // 密码
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

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V4'; // Updated Key
const INTERACTION_KEY = 'HEALTH_GUARD_INTERACTIONS_V1';
const CHAT_KEY = 'HEALTH_GUARD_CHATS_V1';

// ... (Fetch/Save functions remain same, omitted for brevity, keeping existing logic) ...
// 1. Content (Resources)
export const fetchContent = async (type?: string | string[], status?: 'active' | 'pending'): Promise<ContentItem[]> => {
  if (isSupabaseConfigured()) {
      try {
          let query = supabase.from('app_content').select('*');
          if (type) {
              if (Array.isArray(type)) query = query.in('type', type);
              else query = query.eq('type', type);
          }
          if (status) query = query.eq('status', status);
          const { data, error } = await query.order('updated_at', { ascending: false });
          if (!error && data) return data.map(d => ({ ...d, updatedAt: d.updated_at, isUserUpload: d.is_user_upload })); 
      } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 50));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  if (type) {
      if (Array.isArray(type)) all = all.filter(i => type.includes(i.type));
      else all = all.filter(i => i.type === type);
  }
  if (status !== undefined) all = all.filter(i => i.status === status);
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const saveContent = async (item: ContentItem): Promise<boolean> => {
  if (isSupabaseConfigured()) {
      try {
          const payload = {
              id: item.id, type: item.type, title: item.title, description: item.description,
              tags: item.tags, image: item.image, author: item.author, is_user_upload: item.isUserUpload,
              details: item.details, status: item.status, updated_at: new Date().toISOString()
          };
          const { error } = await supabase.from('app_content').upsert(payload);
          if (!error) return true;
      } catch (e) {}
  }
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

// ... (Interaction functions omitted, assume same) ...
export const fetchInteractions = async (type?: string): Promise<InteractionItem[]> => {
    // ... same logic ...
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    if (type) all = all.filter(i => i.type === type);
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
export const saveInteraction = async (item: InteractionItem): Promise<boolean> => {
    // ... same logic ...
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    all.push(item);
    localStorage.setItem(INTERACTION_KEY, JSON.stringify(all));
    return true;
};
export const updateInteractionStatus = async (id: string, status: InteractionItem['status']): Promise<boolean> => {
    // ... same logic ...
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(i => i.id === id);
    if (idx >= 0) { all[idx].status = status; localStorage.setItem(INTERACTION_KEY, JSON.stringify(all)); return true; }
    return false;
};
export const fetchMessages = async (userId: string, doctorId: string): Promise<ChatMessage[]> => {
    // ... same logic ...
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    return all.filter(m => (m.senderId === userId && m.receiverId === doctorId) || (m.senderId === doctorId && m.receiverId === userId)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
export const sendMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>): Promise<ChatMessage> => {
    // ... same logic ...
    const newMsg: ChatMessage = { ...msg, id: `msg_${Date.now()}`, timestamp: new Date().toISOString(), read: false };
    const raw = localStorage.getItem(CHAT_KEY);
    let all: ChatMessage[] = raw ? JSON.parse(raw) : [];
    all.push(newMsg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    return newMsg;
};

// --- Seed Data Updated to Match Requirements ---
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
            { 
                id: 'e1', type: 'exercise', title: '高血压康复操', image: '🧘', tags: ['慢病康复'], author: '康复科', status: 'active', updatedAt: new Date().toISOString(), 
                details: { 
                    exerciseType: '有氧+拉伸',
                    frequency: '每周5次',
                    intensity: '低中强度 (心率<110)',
                    duration: '每次20分钟',
                    calories: '80 kcal',
                    prepWork: '穿着宽松衣物，监测运动前血压',
                    contraindications: '血压>160/100时禁止运动，头晕即停'
                } 
            },
            { 
                id: 'ev1', type: 'event', title: '春季健步走', image: '🚶', tags: ['户外'], status: 'active', updatedAt: new Date().toISOString(), 
                description: '集体户外活动',
                details: { 
                    eventCategory: '体育活动',
                    date: '2024-06-01 09:00',
                    loc: '郑大新校区体育场',
                    registered: 12,
                    max: 50,
                    organizer: '校工会',
                    contact: '李老师 13800000000',
                    deadline: '2024-05-30'
                } 
            },
            { 
                id: 's1', type: 'service', title: '冠脉CTA检查', image: '🩻', tags: ['检查'], status: 'active', updatedAt: new Date().toISOString(), 
                details: { 
                    serviceCategory: '影像检查',
                    dept: '放射科',
                    price: '1200元',
                    clinicalSignificance: '评估冠状动脉狭窄程度，排查冠心病',
                    targetAudience: '胸痛患者、高危人群筛查',
                    preCheckPrep: '检查前4小时禁食，需控制心率在70以下'
                } 
            },
            { 
                id: 'd1', type: 'drug', title: '阿司匹林肠溶片', image: '💊', tags: ['抗血小板'], status: 'active', updatedAt: new Date().toISOString(), 
                details: { 
                    spec: '100mg*30片',
                    usage: '降低急性心肌梗死疑似患者的发病风险',
                    dosage: '每日1次，每次1片(100mg)',
                    adminRoute: '口服',
                    timingNotes: '餐前30分钟服用，整片吞服不可嚼碎',
                    sideEffects: '胃肠道反应、出血倾向',
                    drugContraindications: '活动性溃疡、血友病禁用',
                    interactions: '与布洛芬同服可能减弱抗血小板效应',
                    storage: '密封，25度以下保存，有效期36个月',
                    missedDose: '想起时立即补服，若接近下次时间则跳过，不可加倍'
                } 
            },
            { 
                id: 'doc1', type: 'doctor', title: '张伟', image: '👨‍⚕️', tags: ['全科'], status: 'active', updatedAt: new Date().toISOString(), 
                details: { 
                    dept: '全科医疗科',
                    title: '主任医师',
                    specialty: '高血压、糖尿病及慢病综合管理',
                    schedule: '周一上午、周三下午',
                    hospital: '郑州大学医院',
                    username: 'dr_zhang',
                    password: '123'
                } 
            },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
