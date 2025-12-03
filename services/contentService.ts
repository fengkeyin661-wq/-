
// Simulated Content Service
export interface ContentItem {
  id: string;
  type: 'meal' | 'article' | 'course' | 'event' | 'drug' | 'doctor';
  title: string;
  description?: string; // Ingredients for meals, content for articles
  tags?: string[];
  image?: string; // Emoji or URL
  details?: any; // Flexible JSON: {cal, price, date, loc, stock, spec, dept}
  status: 'active' | 'draft';
  updatedAt: string;
}

const STORAGE_KEY = 'HEALTH_COMMUNITY_CONTENT_V1';

export const fetchContent = async (type?: string): Promise<ContentItem[]> => {
  // Simulate delay
  await new Promise(r => setTimeout(r, 200));
  const raw = localStorage.getItem(STORAGE_KEY);
  const all: ContentItem[] = raw ? JSON.parse(raw) : [];
  return type ? all.filter(i => i.type === type) : all;
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
  if (!raw) return false;
  let all: ContentItem[] = JSON.parse(raw);
  const filtered = all.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

// Seed initial data if empty
export const seedInitialData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialData: ContentItem[] = [
            { id: '1', type: 'meal', title: '低脂鸡胸肉套餐', image: '🍱', description: '鸡胸肉 150g, 西兰花 100g, 杂粮饭', details: { cal: '450kcal', price: '25' }, tags: ['高蛋白', '低盐'], status: 'active', updatedAt: new Date().toISOString() },
            { id: '2', type: 'article', title: '春季流感预防指南', image: '🍃', description: '详细的春季传染病预防知识', tags: ['科普'], status: 'active', updatedAt: new Date().toISOString() },
            { id: '3', type: 'event', title: '环湖健步走', image: '🚶', description: '职工健身活动', details: { date: '周六 08:00', loc: '如意湖', max: 50 }, status: 'active', updatedAt: new Date().toISOString() },
            { id: '4', type: 'drug', title: '布洛芬缓释胶囊', details: { stock: '充足', spec: '0.3g*24粒' }, status: 'active', updatedAt: new Date().toISOString() },
            { id: '5', type: 'doctor', title: '张主任', details: { dept: '心内科', title: '主任医师' }, description: '擅长高血压诊治', status: 'active', updatedAt: new Date().toISOString() },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    }
};
