import { saveInteraction } from './contentService';
import { buildBookingDetails, resolveBookingUserId } from './bookingContact';

export const CHECKUP_FEEDBACK_MARKER = '体检意见反馈';

export function isCheckupFeedback(item: { type?: string; details?: string }): boolean {
  if (item.type === 'checkup_feedback') return true;
  return String(item.details || '').includes(CHECKUP_FEEDBACK_MARKER);
}

export function parseCheckupFeedbackContent(details?: string): string {
  const raw = String(details || '');
  const m = raw.match(/体检意见反馈：(.+)$/);
  return m ? m[1].trim() : raw;
}

export function parseCheckupFeedbackContact(details?: string): {
  contactName: string;
  contactPhone: string;
} {
  const raw = String(details || '');
  const withPhone = raw.match(/【登记】姓名：([^；;]+)[；;]\s*联系电话：([^|]+)/);
  if (withPhone) {
    return { contactName: withPhone[1].trim(), contactPhone: withPhone[2].trim() };
  }
  const nameOnly = raw.match(/【登记】姓名：([^|]+)/);
  return {
    contactName: nameOnly?.[1]?.trim() || '',
    contactPhone: '',
  };
}

export async function submitCheckupFeedback(params: {
  content: string;
  contactName?: string;
  contactPhone?: string;
}): Promise<void> {
  const content = params.content.trim();
  if (!content) {
    throw new Error('请填写意见建议');
  }
  if (content.length > 500) {
    throw new Error('意见建议请控制在 500 字以内');
  }

  const name = params.contactName?.trim() || '匿名用户';
  const phone = params.contactPhone?.trim() || '';
  const detailsLine = `${CHECKUP_FEEDBACK_MARKER}：${content}`;
  const details = phone
    ? buildBookingDetails(name, phone, detailsLine)
    : `【登记】姓名：${name} | ${detailsLine}`;

  const uid = phone ? resolveBookingUserId(undefined, phone) : `guest_feedback_${Date.now()}`;

  await saveInteraction({
    id: `checkup_feedback_${Date.now()}`,
    type: 'checkup_feedback',
    userId: uid,
    userName: name,
    targetId: 'checkup_portal',
    targetName: '体检预约站',
    status: 'pending',
    date: new Date().toISOString().split('T')[0],
    details,
  });
}
