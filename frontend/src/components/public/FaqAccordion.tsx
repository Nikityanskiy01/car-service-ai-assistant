import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div className="fm-faq">
      {items.map((item, index) => (
        <details key={item.q} className="fm-faq-item">
          <summary>
            <span className="fm-faq-question">
              <span className="fm-faq-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="fm-faq-text">{item.q}</span>
            </span>
            <span className="fm-faq-toggle" aria-hidden="true">
              <ChevronDown size={18} strokeWidth={2.25} />
            </span>
          </summary>
          <div className="fm-faq-answer">
            <p>{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
