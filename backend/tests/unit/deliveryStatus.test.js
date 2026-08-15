import { resolveDeliveryStatus } from '../../src/modules/requestMessages/requestMessages.service.js';

describe('resolveDeliveryStatus', () => {
  const user = { id: 'u1', role: 'CLIENT' };

  it('returns null for someone else\'s message', () => {
    expect(
      resolveDeliveryStatus({ authorId: 'other', createdAt: new Date() }, user, new Date()),
    ).toBeNull();
  });

  it('returns sent when the peer has not read yet', () => {
    expect(
      resolveDeliveryStatus({ authorId: 'u1', createdAt: new Date() }, user, null),
    ).toBe('sent');
  });

  it('returns read when created at or before peer read watermark', () => {
    const createdAt = new Date('2026-08-15T14:00:00.000Z');
    const peerReadAt = new Date('2026-08-15T14:05:00.000Z');
    expect(resolveDeliveryStatus({ authorId: 'u1', createdAt }, user, peerReadAt)).toBe('read');
  });

  it('stays sent when the message is newer than the peer read watermark', () => {
    const createdAt = new Date('2026-08-15T14:10:00.000Z');
    const peerReadAt = new Date('2026-08-15T14:05:00.000Z');
    expect(resolveDeliveryStatus({ authorId: 'u1', createdAt }, user, peerReadAt)).toBe('sent');
  });
});
