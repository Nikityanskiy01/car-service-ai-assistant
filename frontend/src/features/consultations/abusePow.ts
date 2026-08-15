import { api } from '../../api/client';

type AbuseChallenge = {
  nonce: string;
  issuedAt: number;
  difficulty: number;
  sig: string;
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function solveAbuseChallenge(): Promise<Record<string, string>> {
  const challenge = await api<AbuseChallenge>('/consultations/abuse-challenge');
  const difficulty = Math.max(0, Number(challenge.difficulty) || 0);
  const prefix = '0'.repeat(difficulty);
  const nonce = String(challenge.nonce || '');
  for (let n = 0; n < 4_000_000; n += 1) {
    const proof = String(n);
    const hash = await sha256Hex(`${nonce}:${proof}`);
    if (hash.startsWith(prefix)) {
      return {
        'X-Abuse-Nonce': nonce,
        'X-Abuse-Issued': String(challenge.issuedAt),
        'X-Abuse-Difficulty': String(difficulty),
        'X-Abuse-Sig': String(challenge.sig || ''),
        'X-Abuse-Solution': proof,
      };
    }
  }
  throw new Error('Не удалось пройти проверку антибота. Обновите страницу и попробуйте снова.');
}
