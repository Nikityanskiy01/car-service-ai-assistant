import { isPreferredAtInMoscowBookingWindow } from '/js/booking-hours.js';
import { api } from '/js/api.js';
import { mountHeaderFooter } from '/js/layout.js';
import { attachPhoneInputMask, isValidPhoneInput } from '/js/phone.js';
import { consumeBookingPrefill } from '/js/services-page.js';
import { uiAlert } from '/js/ui/dialogs.js';

function markField(el, valid) {
  const field = el?.closest('.form-field');
  if (!field) return;
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid);
}

function setMinDateTime(input) {
  if (!input || input.type !== 'datetime-local') return;
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.min = now.toISOString().slice(0, 16);
}

mountHeaderFooter({ active: 'services' });

const prefill = consumeBookingPrefill();
const summaryEl = document.getElementById('bookingServiceSummary');
const leadEl = document.getElementById('bookingLead');

if (prefill?.serviceTitle && summaryEl) {
  summaryEl.hidden = false;
  const cat = prefill.categoryLabel ? ` · ${prefill.categoryLabel}` : '';
  summaryEl.innerHTML = `<strong>Выбрано:</strong> ${prefill.serviceTitle}${cat}`;
}

if (prefill?.serviceTitle && leadEl) {
  leadEl.textContent =
    'Осталось указать контакты и удобное время — менеджер подтвердит визит. Регистрация не требуется.';
}

const form = document.getElementById('guestBookingForm');
const errBanner = document.getElementById('guestBookingError');
const note = document.getElementById('guestBookingNote');
const nameEl = document.getElementById('bkName');
const phoneEl = document.getElementById('bkPhone');
const emailEl = document.getElementById('bkEmail');
const whenEl = document.getElementById('bkWhen');
const notesEl = document.getElementById('bkNotes');
const submitBtn = document.getElementById('guestBookingSubmit');

setMinDateTime(whenEl);

if (phoneEl) attachPhoneInputMask(phoneEl);

if (form && nameEl && phoneEl && whenEl) {
  const defaultSubmitLabel = submitBtn?.textContent || 'Отправить';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (note) note.hidden = true;
    if (errBanner) {
      errBanner.hidden = true;
      errBanner.textContent = '';
    }
    form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));

    const fullName = String(nameEl.value || '').trim();
    const phone = String(phoneEl.value || '').trim();
    const emailRaw = String(emailEl?.value || '').trim();
    const whenRaw = String(whenEl.value || '').trim();
    const notes = String(notesEl?.value || '').trim();

    let hasErr = false;
    if (!fullName) {
      markField(nameEl, false);
      if (!hasErr) {
        nameEl.focus();
        hasErr = true;
      }
    } else {
      markField(nameEl, true);
    }
    if (!phone) {
      markField(phoneEl, false);
      if (!hasErr) {
        phoneEl.focus();
        hasErr = true;
      }
    } else if (!isValidPhoneInput(phone)) {
      markField(phoneEl, false);
      if (!hasErr) phoneEl.focus();
      hasErr = true;
    } else {
      markField(phoneEl, true);
    }
    if (!whenRaw) {
      markField(whenEl, false);
      if (!hasErr) whenEl.focus();
      hasErr = true;
    } else {
      const at = new Date(whenRaw);
      if (Number.isNaN(at.getTime())) {
        markField(whenEl, false);
        if (!hasErr) whenEl.focus();
        hasErr = true;
      } else if (!isPreferredAtInMoscowBookingWindow(at)) {
        markField(whenEl, false);
        if (errBanner) {
          errBanner.textContent =
            'Запись доступна с 9:00 до 21:00 по московскому времени. Выберите другое время.';
          errBanner.hidden = false;
        }
        if (!hasErr) whenEl.focus();
        hasErr = true;
      } else {
        markField(whenEl, true);
      }
    }
    if (hasErr) return;

    const at = new Date(whenRaw);
    form.setAttribute('aria-busy', 'true');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка…';
    }

    try {
      await api(
        '/bookings/guest',
        {
          method: 'POST',
          body: {
            fullName,
            phone,
            email: emailRaw || null,
            preferredAt: at.toISOString(),
            notes: notes || null,
            serviceTitle: prefill?.serviceTitle || null,
            categoryLabel: prefill?.categoryLabel || null,
          },
          skipAuth: true,
        },
      );
      form.reset();
      form.querySelectorAll('.form-field').forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
      setMinDateTime(whenEl);
      if (note) note.hidden = false;
      await uiAlert({
        title: 'Запись принята',
        message:
          'Благодарим за обращение. Ваша заявка зарегистрирована; в ближайшее рабочее время администратор Fox Motors свяжется с вами для согласования времени визита.',
        footnote:
          'Автомобиль пока стоит спокойно — зато у нас уже зажглась «новая запись» в календаре. Звоним по делу, без лишней суеты.',
        variant: 'success',
        okText: 'Понятно',
      });
    } catch (err) {
      if (errBanner) {
        errBanner.textContent = err.message || 'Не удалось отправить. Попробуйте позже.';
        errBanner.hidden = false;
      }
    } finally {
      form.setAttribute('aria-busy', 'false');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultSubmitLabel;
      }
    }
  });
}
