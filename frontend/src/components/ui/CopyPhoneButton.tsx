import { useState } from 'react';
import { Copy } from 'lucide-react';
import { copyText } from '../../lib/clipboard';
import { Button } from './Button';

export function CopyPhoneButton({ phone, label = 'Скопировать' }: { phone: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      className="copy-phone-btn"
      title={label || 'Скопировать номер'}
      aria-label={label || 'Скопировать номер'}
      onClick={() => {
        void copyText(phone).then((ok) => {
          if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }
        });
      }}
    >
      <Copy size={14} aria-hidden />
      {copied ? (label ? 'Скопировано' : null) : label}
    </Button>
  );
}
