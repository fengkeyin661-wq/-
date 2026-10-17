import type { ContentItem } from './contentService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const RESOURCE_IMAGE_BUCKET = 'resource-images';

export const isDataUrlImage = (v?: string): v is string =>
  !!v && v.startsWith('data:image');

export const isRemoteImageUrl = (v?: string): boolean =>
  !!v && (v.startsWith('http://') || v.startsWith('https://'));

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片文件失败'));
    reader.readAsDataURL(file);
  });
}

/** 浏览器端压缩，避免 Base64 过大导致保存超时或 localStorage 溢出 */
export function compressImageDataUrl(dataUrl: string, maxDim: number, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height, 1));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法压缩图片'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('图片压缩失败'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

export async function uploadResourceImage(source: string | Blob | File, objectPath: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('未配置 Supabase，无法上传图片到云端');
  }

  let blob: Blob;
  let contentType = 'image/jpeg';

  if (typeof source === 'string' && isDataUrlImage(source)) {
    blob = await compressImageDataUrl(source, 1920);
  } else if (source instanceof Blob) {
    blob = source;
    contentType = source.type || 'image/jpeg';
  } else {
    throw new Error('不支持的图片格式');
  }

  const { error } = await supabase.storage.from(RESOURCE_IMAGE_BUCKET).upload(objectPath, blob, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });

  if (error) {
    throw new Error(`图片上传失败: ${error.message}`);
  }

  const { data } = supabase.storage.from(RESOURCE_IMAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadPackageImageFile(
  file: File,
  itemId: string,
  target: 'cover' | 'poster',
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const maxDim = target === 'cover' ? 800 : 1920;
  const blob = await compressImageDataUrl(dataUrl, maxDim);
  const path = `checkup_package/${itemId}/${target}-${Date.now()}.jpg`;
  return uploadResourceImage(blob, path);
}

/** 保存前兜底：将仍为 Base64 的图片字段上传到 Storage，数据库只存 URL */
export async function prepareContentItemImages(item: ContentItem): Promise<ContentItem> {
  if (!isSupabaseConfigured()) return item;

  const next: ContentItem = { ...item, details: item.details ? { ...item.details } : {} };
  const prefix = `${item.type}/${item.id}`;

  if (isDataUrlImage(next.image)) {
    const blob = await compressImageDataUrl(next.image, 1200);
    next.image = await uploadResourceImage(blob, `${prefix}/cover-${Date.now()}.jpg`);
  }

  const poster = next.details?.posterImage;
  if (isDataUrlImage(poster)) {
    const blob = await compressImageDataUrl(poster, 1920);
    next.details = {
      ...next.details,
      posterImage: await uploadResourceImage(blob, `${prefix}/poster-${Date.now()}.jpg`),
    };
  }

  const wechatQr = next.details?.wechat_qr;
  if (isDataUrlImage(wechatQr)) {
    const blob = await compressImageDataUrl(wechatQr, 512);
    next.details = {
      ...next.details,
      wechat_qr: await uploadResourceImage(blob, `${prefix}/wechat-qr-${Date.now()}.jpg`),
    };
  }

  return next;
}
