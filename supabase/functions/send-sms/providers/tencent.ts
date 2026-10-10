/** 腾讯云短信（可选，通过 SMS_PROVIDER=tencent 启用） */

export interface TencentSendInput {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  templateId: string;
  phone: string;
  templateParam: string[];
}

export interface TencentSendResult {
  success: boolean;
  bizId?: string;
  code?: string;
  message?: string;
}

export const sendTencentSms = async (_input: TencentSendInput): Promise<TencentSendResult> => {
  return {
    success: false,
    code: 'NOT_IMPLEMENTED',
    message: '腾讯云短信适配器尚未配置，请使用 SMS_PROVIDER=aliyun 或完善 tencent.ts',
  };
};
