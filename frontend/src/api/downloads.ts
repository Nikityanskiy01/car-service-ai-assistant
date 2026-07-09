import { ApiError, localizeApiError } from './errors';

export async function downloadApiBlob(
  path: string,
  options: RequestInit & { guestToken?: string | null } = {},
): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers(options.headers || {});
  if (options.guestToken) headers.set('X-Consultation-Guest-Token', options.guestToken);

  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || response.statusText };
    }
    throw new ApiError(localizeApiError(response.status, data, response.statusText), response.status, data);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const star = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(contentDisposition);
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(contentDisposition);
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(contentDisposition);
  let filename = 'download.bin';

  if (star) {
    filename = decodeURIComponent(star[1]);
  } else if (quoted) {
    filename = quoted[1];
  } else if (plain) {
    filename = plain[1].replace(/^["']|["']$/g, '');
  }

  return { blob, filename };
}

export async function downloadApiFile(
  path: string,
  options: RequestInit & { guestToken?: string | null } = {},
): Promise<void> {
  const { blob, filename } = await downloadApiBlob(path, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
