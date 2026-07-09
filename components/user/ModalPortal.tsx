import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: React.ReactNode;
  /** 弹窗打开时锁定背景滚动 */
  lockScroll?: boolean;
}

/**
 * 将全屏/底部弹层挂载到 document.body，避免嵌套在 overflow 容器或 transform 动画父级内时
 * position:fixed 相对错误参照系（移动端常见：弹窗出现在页面底部需滚动才能看到）。
 */
export const ModalPortal: React.FC<Props> = ({ children, lockScroll = true }) => {
  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
