
// Simulated Content Service
export interface ContentItem {
  id: string;
  type: 'meal' | 'exercise' | 'article' | 'event' | 'drug' | 'doctor' | 'service';
  title: string;
  description?: string; // Short desc
  tags: string[]; // Used for smart recommendation matching (e.g., '高血压', '减重')
  image?: string; // Emoji or URL
  author?: string; // '官方' or User Name
  isUserUpload?: boolean;
  
  // Detailed Content Fields (Flexible JSON)
  details?: {
    // Meal
    ingredients?: string;
    steps?: string;
    nutrition?: string; // e.g. "热量:400kcal, 蛋白:20g"
    cal?: string; // For simplified calorie input in Admin

    // Exercise
    difficulty?: '低' | '中' | '高';
    duration?: string;
    calories?: string;
    contraindications?: string; // 禁忌症
    content?: string; // 具体运动内容

    // Medical/Doctor
    dept?: string;
    title?: string; // 职称
    hospital?: string;
    price?: string;
    stock?: string;
    spec?: string; // Drug specification
    
    // Event
    date?: string;
    loc?: string;
    max?: number;
    registered?: number;
  };
  
  status: 'active' | 'pending'; // User uploads might be pending
  updatedAt: string;
}

const STORAGE_KEY = 'HEALTH_GUARD_CONTENT_V2';

export const fetchContent = async (type?: string | string[]): Promise<ContentItem[]> => {
  // Simulate delay
  await new Promise(r => setTimeout(r, 100));
  const raw = localStorage.getItem(STORAGE_KEY);
  let all: ContentItem[] = raw ? JSON.parse(raw) : [];
  
  // Filter
  if (type) {
      if (Array.isArray(type)) {
          all = all.filter(i => type.includes(i.type));
      } else {
          all = all.filter(i => i.type === type);
      }
  }
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

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

// Seed initial data if empty
export const seedInitialData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialData: ContentItem[] = [
            // --- 1. Meals (Diet) ---
            { 
                id: 'm1', type: 'meal', title: 'DASH降压午餐', image: '🍱', tags: ['高血压', '减重', '高血脂'], 
                author: '营养科', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '专为高血压人群设计的低钠高钾餐',
                details: {
                    ingredients: '糙米饭150g, 清蒸鲈鱼100g, 凉拌菠菜150g, 坚果10g',
                    steps: '1. 鲈鱼少盐清蒸... 2. 菠菜焯水... 3. 搭配糙米...',
                    nutrition: '热量: 550kcal, 钠: 200mg, 钾: 800mg',
                    cal: '550'
                }
            },
            { 
                id: 'm2', type: 'meal', title: '控糖杂粮碗', image: '🥗', tags: ['糖尿病', '高血糖', '减重'], 
                author: '官方推荐', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '低GI值，饱腹感强',
                details: { ingredients: '藜麦50g, 鸡胸肉100g, 西兰花, 彩椒', nutrition: '热量: 400kcal, GI值: 45', cal: '400' }
            },
            { 
                id: 'm3', type: 'meal', title: '自制减脂沙拉', image: '🥬', tags: ['减重', '分享'], 
                author: '王老师(职工)', isUserUpload: true, status: 'active', updatedAt: new Date().toISOString(),
                description: '我的午餐打卡，清爽好吃',
                details: { ingredients: '生菜, 黄瓜, 金枪鱼', steps: '洗净切块，加入油醋汁' }
            },

            // --- 2. Exercises ---
            { 
                id: 'e1', type: 'exercise', title: '初级降压太极拳', image: '🧘', tags: ['高血压', '老年', '康复'], 
                author: '运动医学科', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '平心静气，辅助降压',
                details: { difficulty: '低', duration: '20分钟', calories: '80kcal', contraindications: '急性心衰期', content: '起势...野马分鬃...' }
            },
            { 
                id: 'e2', type: 'exercise', title: 'HIIT燃脂训练', image: '🔥', tags: ['减重', '肥胖', '青年'], 
                author: '健身教练', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '快速燃烧卡路里',
                details: { difficulty: '高', duration: '15分钟', calories: '200kcal', contraindications: '高血压, 心脏病', content: '开合跳...波比跳...' }
            },

            // --- 3. Doctors ---
            { 
                id: 'd1', type: 'doctor', title: '张主任', image: '👨‍⚕️', tags: ['高血压', '心血管'], 
                author: '官方', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '擅长难治性高血压',
                details: { dept: '心血管内科', title: '主任医师', hospital: '郑州大学医院' }
            },
            { 
                id: 'd2', type: 'doctor', title: '李教练', image: '🏃', tags: ['运动', '康复'], 
                author: '官方', isUserUpload: false, status: 'active', updatedAt: new Date().toISOString(),
                description: '运动处方制定专家',
                details: { dept: '健康管理中心', title: '高级健康管理师' }
            },

            // --- 4. Medical Services ---
            { 
                id: 's1', type: 'service', title: '上门抽血服务', image: '🩸', tags: ['检验', '便民'], 
                status: 'active', updatedAt: new Date().toISOString(),
                description: '护士上门采集，结果在线查询',
                details: { price: '50元/次' }
            },
            { 
                id: 's2', type: 'drug', title: '硝苯地平控释片', image: '💊', tags: ['高血压', '药品'], 
                status: 'active', updatedAt: new Date().toISOString(),
                description: '拜新同 30mg*7片',
                details: { stock: '充足', price: '32.5元', spec: '30mg*7片' }
            },

            // --- 5. Community Events ---
            { 
                id: 'ev1', type: 'event', title: '低脂健康美食品鉴会', image: '🍲', tags: ['沙龙', '饮食'], 
                status: 'active', updatedAt: new Date().toISOString(),
                description: '现场制作，免费品尝',
                details: { date: '本周五 15:00', loc: '职工餐厅', max: 30, registered: 12 }
            },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
