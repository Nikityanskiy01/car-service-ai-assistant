import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml } from '../utils.js';

export async function initAdminDashboard() {
  const user = requireAuth(['ADMINISTRATOR']);
  if (!user) return;

  async function loadUsers() {
    const users = await api('/admin/users');
    $('#adminUsers tbody').innerHTML = users
      .map(
        (u) => `<tr>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${u.role}</td>
        <td>${u.blocked ? 'да' : 'нет'}</td>
        <td>
          <select data-user="${u.id}" class="roleSel">
            <option value="CLIENT" ${u.role === 'CLIENT' ? 'selected' : ''}>CLIENT</option>
            <option value="MANAGER" ${u.role === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
            <option value="ADMINISTRATOR" ${u.role === 'ADMINISTRATOR' ? 'selected' : ''}>ADMIN</option>
          </select>
          <button type="button" class="btn btn--ghost saveRole" data-user="${u.id}">Роль</button>
          <button type="button" class="btn btn--ghost blockU" data-user="${u.id}">Блок</button>
          <button type="button" class="btn btn--ghost unblockU" data-user="${u.id}">Разблок</button>
        </td>
      </tr>`,
      )
      .join('');

    $('#adminUsers').querySelectorAll('.saveRole').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.user;
        const sel = document.querySelector(`select.roleSel[data-user="${id}"]`);
        await api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role: sel.value } });
        await loadUsers();
      });
    });
    $('#adminUsers').querySelectorAll('.blockU').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/admin/users/${btn.dataset.user}/block`, { method: 'POST' });
        await loadUsers();
      });
    });
    $('#adminUsers').querySelectorAll('.unblockU').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/admin/users/${btn.dataset.user}/unblock`, { method: 'POST' });
        await loadUsers();
      });
    });
  }

  $('#catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/admin/reference/service-categories', {
      method: 'POST',
      body: { name: fd.get('name'), description: fd.get('description') || undefined },
    });
    alert('Категория создана');
    e.target.reset();
  });

  $('#scForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/admin/reference/scenarios', {
      method: 'POST',
      body: { title: fd.get('title'), description: fd.get('description') || undefined },
    });
    alert('Сценарий создан');
    e.target.reset();
  });

  const summary = await api('/analytics/summary');
  $('#analyticsBox').textContent = JSON.stringify(summary, null, 2);

  await loadUsers();
}
