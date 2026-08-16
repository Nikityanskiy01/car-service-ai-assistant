import { isSmsConfigured, isSmsDeliveryReady, sendSms, getLastTestSms, clearLastTestSms } from '../../src/lib/sms/sms.service.ts';

describe('sms.service', () => {
  beforeEach(() => {
    clearLastTestSms();
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_API_KEY;
  });

  test('unconfigured in test still records last SMS', async () => {
    expect(isSmsConfigured()).toBe(false);
    expect(isSmsDeliveryReady()).toBe(false);
    await sendSms({ to: '+79990001122', text: 'Код 123456' });
    expect(getLastTestSms()).toEqual({ to: '79990001122', text: 'Код 123456' });
  });

  test('smsru with key is configured', () => {
    process.env.SMS_PROVIDER = 'smsru';
    process.env.SMS_API_KEY = 'test-key';
    expect(isSmsConfigured()).toBe(true);
    expect(isSmsDeliveryReady()).toBe(true);
  });
});
