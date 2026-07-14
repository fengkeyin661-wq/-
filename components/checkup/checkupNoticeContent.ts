/** 体检预约门户 — 体检须知与到检指引 */

export const CHECKUP_NOTICE_TITLE = '体检须知';

export const CHECKUP_NOTICE_ITEMS: string[] = [
  '体检时请携带个人身份证件；',
  '体检前一天要求清淡饮食，严禁饮酒；',
  '体检当天早晨必须空腹（禁食、禁水8小时），以便抽血进行实验室检查和腹部超声检查；',
  '有既往病史的，在体检时应事先告知主检医师；',
  '不要穿戴金属饰物，X光检查前，要摘掉上身佩带的金属性物品；',
  '半年内计划怀孕或已怀孕的体检者，要预先告知体检医生，不要做放射性检查；',
  '体检时勿携带贵重物品，个人物品需妥善保管，以免遗失；',
  '体检期间，如出现不适，请及时与医院前台负责人或导检人员联系；',
  '如自愿放弃个别体检项目，请及时通知登记处，否则将影响体检报告的及时发放。',
];

export const CHECKUP_TIME_INFO = {
  title: '体检时间',
  content: '周一至周五上午 8:00–10:30，团检时间另行协商。',
};

export const CHECKUP_ADDRESS_INFO = {
  title: '体检地址',
  content:
    '郑州市高新区莲花街与长椿路交叉口向西100米（郑州大学新区北侧）郑州大学医院4楼体检科。',
};

export const CHECKUP_TRANSPORT_INFO = {
  title: '乘车路线',
  items: [
    '地铁1号线在河南工业大学站（E口）下车，向西200米从郑州大学北门进入，左拐向东50米即达。',
    '私家车从郑州大学北门进出，进门左拐50米即达。',
  ],
};

export const CHECKUP_CONTACT_PHONES = ['0371-67739261', '0371-67739538'] as const;

export const CHECKUP_CONTACT_FOOTER =
  '若您有任何疑问请致电以上电话，校医院竭诚为您服务！';
