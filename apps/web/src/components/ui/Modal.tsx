import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  closeOnBackdrop?: boolean;
}

export function Modal({ open, title, onClose, children, footer, size = 'md', closeOnBackdrop = false }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
      data-modal-overlay="true"
    >
      <div
        className={`${styles.dialog} ${size === 'lg' ? styles.lg : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={stopPropagation}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" aria-label="닫기" className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
