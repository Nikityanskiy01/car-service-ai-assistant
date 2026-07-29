import type { FollowUpAttachment } from '../../api/dashboard';

type Props = {
  attachments?: FollowUpAttachment[];
};

export function MessageAttachmentList({ attachments = [] }: Props) {
  if (!attachments.length) return null;

  return (
    <ul className="message-attachment-list">
      {attachments.map((file) => (
        <li key={file.id}>
          {file.mimeType.startsWith('image/') ? (
            <a href={file.url} target="_blank" rel="noreferrer">
              <img src={file.url} alt={file.fileName} loading="lazy" />
            </a>
          ) : (
            <a href={file.url} target="_blank" rel="noreferrer">
              {file.fileName}
            </a>
          )}
          <small className="muted">{Math.round(file.sizeBytes / 1024)} КБ</small>
        </li>
      ))}
    </ul>
  );
}
