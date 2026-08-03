import type { FollowUpAttachment } from '../../api/dashboard';
import { SiteImage } from '../ui/SiteImage';

type Props = {
  attachments?: FollowUpAttachment[];
};

export function MessageAttachmentList({ attachments = [] }: Props) {
  if (!attachments.length) return null;

  return (
    <ul className="message-attachment-list follow-up-message-attachments">
      {attachments.map((file) => (
        <li key={file.id}>
          {file.mimeType.startsWith('image/') ? (
            <a href={file.url} target="_blank" rel="noreferrer" className="follow-up-attachment-image">
              <SiteImage src={file.url} alt={file.fileName} recover={false} />
            </a>
          ) : (
            <a href={file.url} target="_blank" rel="noreferrer" className="follow-up-attachment-file">
              {file.fileName}
            </a>
          )}
          <small className="muted">{Math.round(file.sizeBytes / 1024)} КБ</small>
        </li>
      ))}
    </ul>
  );
}
