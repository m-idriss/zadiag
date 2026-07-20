import { AppIcon } from './Icon';
import { useModalFocus } from '../hooks/useModalFocus';
import type { ReactNode } from 'react';

export function ProofLightbox({ src, alt, closeLabel, actions, onClose }: {
  src: string;
  alt: string;
  closeLabel: string;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);

  return (
    <div ref={dialogRef} className="proof-lightbox" role="dialog" aria-modal="true" aria-label={alt} tabIndex={-1} onClick={onClose}>
      <button type="button" className="proof-lightbox-close" data-autofocus aria-label={closeLabel} onClick={onClose}><AppIcon name="close" /></button>
      <div className={`proof-lightbox-content${actions ? ' has-actions' : ''}`} onClick={(event) => event.stopPropagation()}>
        <img src={src} alt={alt} />
        {actions ? <div className="proof-lightbox-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
