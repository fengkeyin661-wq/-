/** 阿里云短信 SendSms（POP 签名） */

const ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

const percentEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');

const randomNonce = (): string =>
  crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const hmacSha1Base64 = async (secret: string, message: string): Promise<string> => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export interface AliyunSendInput {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  phone: string;
  templateParam: Record<string, string>;
}

export interface AliyunSendResult {
  success: boolean;
  bizId?: string;
  code?: string;
  message?: string;
  requestId?: string;
}

export const sendAliyunSms = async (input: AliyunSendInput): Promise<AliyunSendResult> => {
  const params: Record<string, string> = {
    AccessKeyId: input.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: input.phone,
    RegionId: 'cn-hangzhou',
    SignName: input.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomNonce(),
    SignatureVersion: '1.0',
    TemplateCode: input.templateCode,
    TemplateParam: JSON.stringify(input.templateParam),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalized)}`;
  const signature = await hmacSha1Base64(`${input.accessKeySecret}&`, stringToSign);

  const query = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const url = `${ENDPOINT}?${query}&Signature=${encodeURIComponent(signature)}`;

  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();

  if (data?.Code === 'OK') {
    return {
      success: true,
      bizId: data.BizId,
      code: data.Code,
      requestId: data.RequestId,
    };
  }

  return {
    success: false,
    code: data?.Code || 'UNKNOWN',
    message: data?.Message || `HTTP ${res.status}`,
    requestId: data?.RequestId,
  };
};
