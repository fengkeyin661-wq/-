
// Simulated Content Service
export interface ContentItem {
  id: string;
  type: 'meal' | 'exercise' | 'article' | 'event' | 'drug' | 'doctor' | 'service';
  title: string;
  description?: string; // Short desc
  tags: string[]; // Used for smart recommendation matching (e.g., '高血压', '减重')
  image?: string; // Emoji or URL
  author?: string; // '官方' or User Name
  isUserUpload?: boolean; // True if uploaded by user
  
  // Detailed Content Fields (Flexible JSON)
  details?: {
    // --- Meal (Health Recipe) ---
    ingredients?: string; // 配料及用量
    steps?: string; // 制作步骤
    nutrition?: string; // 营养成分
    cal?: string; // 热量
    cookingTime?: string; // 制作时长
    difficulty?: string; // 难度

    // --- Exercise (Motion Plan) ---
    exerciseType?: string; // 运动类型
    frequency?: string; // 频率
    intensity?: string; // 强度
    duration?: string; // 持续时间
    calories?: string; // 消耗热量
    prepWork?: string; // 准备工作/注意事项
    contraindications?: string; // 禁忌症
    content?: string; // 具体内容

    // --- Medical Service ---
    serviceCategory?: '检查' | '检验' | '治疗';
    dept?: string; // 所属科室
    price?: string; // 单价
    clinicalSignificance?: string; // 检查意义
    targetAudience?: string; // 适用人群
    preCheckPrep?: string; // 检查前准备
    
    // --- Drug (Pharmacy) ---
    usage?: string; // 用途/适应症
    dosage?: string; // 用法用量
    adminRoute?: string; // 给药途径
    timingNotes?: string; // 服用时间与注意事项
    sideEffects?: string; // 副作用
    drugContraindications?: string; // 禁忌症
    interactions?: string; // 药物相互作用
    storage?: string; // 储存与有效期
    missedDose?: string; // 漏服处理
    stock?: string; 
    spec?: string;

    // --- Doctor ---
    // dept reused
    title?: string; // 职称
    specialty?: string; // 擅长领域
    hospital?: string;
    schedule?: string; // 门诊时间
    
    // --- Event ---
    eventCategory?: string; // 类别
    date?: string; // 活动时间
    deadline?: string; // 报名截止日期 (NEW)
    loc?: string;
    organizer?: string; // 组织者
    contact?: string; // 联系方式
    max?: number;
    registered?: number;
  };
  
  status: 'active' | 'pending' | 'rejected'; // Audit status
  updatedAt: string;
}

// New Interface for User Interactions (Bookings, Orders, Signings)
export interface InteractionItem {
    id: string;
    type: 'booking' | 'drug_order' | 'signing' | 'event_signup';
    userId: string;
    userName: string;
    targetId: string; // ID of the service/drug/doctor
    targetName: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    date: string;
    details?: string; // e.g. "Address for delivery" or "Appointment time"
}

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V3';
const INTERACTION_KEY = 'HEALTH_GUARD_INTERACTIONS_V1';

// --- Content Functions ---

export const fetchContent = async (type?: string | string[], status?: 'active' | 'pending'): Promise<ContentItem[]> => {
  await new Promise(r => setTimeout(r, 100));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  
  // Filter by Type
  if (type) {
      if (Array.isArray(type)) {
          all = all.filter(i => type.includes(i.type));
      } else {
          all = all.filter(i => i.type === type);
      }
  }

  // Filter by Status (Default to active if not specified, but allowing 'all' if status is undefined in a specific way could be handled, simplified here)
  if (status) {
      all = all.filter(i => i.status === status);
  } else {
      // By default fetchContent returns active items unless specified (backward compat)
      // But for Admin, we might want all. Let's assume if status is undefined, we return active.
      // To get ALL, pass status as undefined and handle filter outside, or change logic.
      // For now: Default is 'active' for user view safety. Admin calls will filter manually or pass specific status.
      if (status !== undefined) {
         all = all.filter(i => i.status === status);
      }
  }
  
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const fetchAllContent = async (): Promise<ContentItem[]> => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

export const saveContent = async (item: ContentItem): Promise<boolean> => {
  await new Promise(r => setTimeout(r, 200));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) {
    all[idx] = { ...item, updatedAt: new Date().toISOString() };
  } else {
    all.push({ ...item, updatedAt: new Date().toISOString() });
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return true;
};

export const deleteContent = async (id: string): Promise<boolean> => {
  await new Promise(r => setTimeout(r, 200));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  
  const newAll = all.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newAll));
  return true;
};

// --- Interaction Functions (Bookings/Orders) ---

export const fetchInteractions = async (type?: string): Promise<InteractionItem[]> => {
    await new Promise(r => setTimeout(r, 100));
    const raw = localStorage.getItem(INTERACTION_KEY);
    let all: InteractionItem[] = raw ? JSON.parse(raw) : [];
    if (type) {
        all = all.filter(i => i.type === type);
    }
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const updateInteractionStatus = async (id: string, status: InteractionItem['status']): Promise<boolean> => {
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

// --- Seeding ---

export const seedInitialData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialData: ContentItem[] = [
            // Meals
            { id: 'm1', type: 'meal', title: 'DASH降压午餐', image: '🍱', tags: ['高血压', '减重'], author: '营养科', status: 'active', updatedAt: new Date().toISOString(), description: '低钠高钾餐', details: { cal: '550', ingredients: '糙米, 鲈鱼' } },
            { id: 'm2', type: 'meal', title: '用户上传: 减脂沙拉', image: '🥗', tags: ['减重'], author: '李老师', isUserUpload: true, status: 'pending', updatedAt: new Date().toISOString(), description: '我的午餐打卡', details: { cal: '300', ingredients: '生菜, 鸡胸肉' } },
            
            // Exercises
            { id: 'e1', type: 'exercise', title: '八段锦跟练', image: '🧘', tags: ['康复'], author: '中医科', status: 'active', updatedAt: new Date().toISOString(), details: { duration: '15min', difficulty: '低' } },
            
            // Drugs
            { id: 'd1', type: 'drug', title: '阿司匹林肠溶片', image: '💊', tags: ['心血管'], status: 'active', updatedAt: new Date().toISOString(), details: { stock: '500', spec: '100mg*30片', price: '12.5', usage: '抗血栓' } },
            
            // Services
            { id: 's1', type: 'service', title: '核磁共振(MRI)', image: '🩻', tags: ['检查'], status: 'active', updatedAt: new Date().toISOString(), details: { price: '600', dept: '放射科' } },
            
            // Doctors
            { id: 'doc1', type: 'doctor', title: '张主任', image: '👨‍⚕️', tags: ['心内科'], status: 'active', updatedAt: new Date().toISOString(), details: { dept: '心血管内科', title: '主任医师', specialty: '高血压, 冠心病' } },
            
            // Events
            { id: 'ev1', type: 'event', title: '春季健步走', image: '🚶', tags: ['活动'], status: 'active', updatedAt: new Date().toISOString(), details: { date: '2024-06-01T09:00', deadline: '2024-05-30T18:00', max: 50, registered: 12, loc: '体育场' } },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }

    if (!localStorage.getItem(INTERACTION_KEY)) {
        const interactions: InteractionItem[] = [
            { id: 'b1', type: 'booking', userId: 'u1', userName: '王老师', targetId: 's1', targetName: '核磁共振(MRI)', status: 'pending', date: '2024-05-20', details: '上午 10:00' },
            { id: 'do1', type: 'drug_order', userId: 'u2', userName: '张教授', targetId: 'd1', targetName: '阿司匹林肠溶片', status: 'pending', date: '2024-05-19', details: '配送地址: 家属院3号楼2单元' },
            { id: 'sig1', type: 'signing', userId: 'u3', userName: '李工', targetId: 'doc1', targetName: '张主任', status: 'pending', date: '2024-05-18', details: '申请签约家庭医生' },
        ];
        localStorage.setItem(INTERACTION_KEY, JSON.stringify(interactions));
    }
};
