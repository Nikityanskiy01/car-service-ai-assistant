import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('GET /api/users/me/summary', () => {
  beforeEach(() => truncateAll());

  it('returns dashboard summary for client', async () => {
    const { token } = await registerClient({ email: 'summary-client@test.local' });

    const res = await request(app)
      .get('/api/users/me/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBeTruthy();
    expect(res.body).toMatchObject({
      activeCasesCount: 0,
      unreadMessagesCount: 0,
      hasAnyHistory: false,
      nextBooking: null,
      draftConsultation: null,
      recentActiveCases: [],
    });
  });
});
