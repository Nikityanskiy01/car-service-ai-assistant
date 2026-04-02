import { api } from '../api.js';
import { requireAuth } from '../router-guard.js';
import { $, escapeHtml } from '../utils.js';
import { uiAlert, uiConfirm, uiPromptText } from '../ui/dialogs.js';

export async function initAdminDashboard() {
  const user = requireAuth(['ADMINISTRATOR']);
  if (!user) return;

  let catsCache = [];
  let matsCache = [];
  let scenariosCache = [];

  function badge(text, tone = 'ghost') {
    const cls =
      tone === 'ok'
        ? 'pill pill--ok'
        : tone === 'warn'
          ? 'pill pill--warn'
          : tone === 'bad'
            ? 'pill pill--bad'
            : 'pill pill--ghost';
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  function setActiveTab(tab) {
    document.querySelectorAll('.dash__tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('.dash__panel').forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
    try {
      window.location.hash = `tab=${encodeURIComponent(tab)}`;
    } catch {
      /* ignore */
    }
  }

  function initTabs() {
    const fromHash = (() => {
      const h = String(window.location.hash || '').replace(/^#/, '');
      const m = h.match(/(?:^|&)tab=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    })();
    const initial = fromHash || 'overview';
    document.querySelectorAll('.dash__tab').forEach((b) => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));
    setActiveTab(initial);
  }

  async function loadSummary() {
    const box = $('#analyticsBox');
    if (box) box.textContent = 'Загружаем сводку…';
    try {
      const summary = await api('/analytics/summary');
      if (box) box.textContent = JSON.stringify(summary, null, 2);
    } catch (e) {
      if (box) box.textContent = '';
      await uiAlert({ title: 'Ошибка', message: e.message || 'Не удалось загрузить сводку.' });
    }
  }

  async function loadUsers() {
    const users = await api('/admin/users');
    const q = ($('#adminUserQ')?.value || '').trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => String(u.email || '').toLowerCase().includes(q) || String(u.fullName || '').toLowerCase().includes(q))
      : users;
    $('#adminUsers tbody').innerHTML = filtered
      .map(
        (u) => `<tr>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${badge(u.role, u.role === 'ADMINISTRATOR' ? 'warn' : u.role === 'MANAGER' ? 'ok' : 'ghost')}</td>
        <td>${u.blocked ? badge('blocked', 'bad') : badge('active', 'ok')}</td>
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
    if (!filtered.length) {
      $('#adminUsers tbody').innerHTML = `<tr><td colspan="5"><div class="empty">Пользователей пока нет.</div></td></tr>`;
    }

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

  async function loadCategories() {
    const cats = await api('/admin/reference/service-categories');
    catsCache = cats;
    const q = ($('#catQ')?.value || '').trim().toLowerCase();
    const filtered = q
      ? cats.filter(
          (c) =>
            String(c.name || '').toLowerCase().includes(q) ||
            String(c.slug || '').toLowerCase().includes(q) ||
            String(c.description || '').toLowerCase().includes(q),
        )
      : cats;
    const tbody = $('#catsTable tbody');
    tbody.innerHTML = filtered
      .map(
        (c) => `<tr data-id="${c.id}" style="cursor:pointer">
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td class="muted">${escapeHtml(c.slug || '')}</td>
        <td class="muted">${escapeHtml(c.description || '')}</td>
        <td style="white-space:nowrap;text-align:right">
          <button type="button" class="btn btn--ghost btn-sm catEdit" data-id="${c.id}">Правка</button>
          <button type="button" class="btn btn--ghost btn-sm catDel" data-id="${c.id}">Удалить</button>
        </td>
      </tr>`,
      )
      .join('');
    if (!filtered.length) {
      tbody.innerHTML = q
        ? `<tr><td colspan="4"><div class="empty">Ничего не найдено по запросу “${escapeHtml(q)}”.</div></td></tr>`
        : `<tr><td colspan="4"><div class="empty">Категорий пока нет. Добавьте первую выше.</div></td></tr>`;
    }

    $('#matCat').innerHTML =
      `<option value="">— без категории —</option>` +
      cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    tbody.querySelectorAll('.catEdit').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const row = cats.find((x) => x.id === id);
        if (!row) return;
        const name = await uiPromptText({
          title: 'Правка категории',
          label: 'Название',
          initialValue: row.name,
          placeholder: 'Название категории',
        });
        if (name == null) return;
        const description = await uiPromptText({
          title: 'Правка категории',
          label: 'Описание (можно пусто)',
          initialValue: row.description || '',
          placeholder: 'Описание',
        });
        if (description == null) return;
        await api(`/admin/reference/service-categories/${id}`, { method: 'PATCH', body: { name, description } });
        await uiAlert({ title: 'Готово', message: 'Категория обновлена.' });
        await loadCategories();
      });
    });
    tbody.querySelectorAll('.catDel').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const ok = await uiConfirm({ title: 'Удалить категорию', message: 'Удалить категорию? Это может быть запрещено, если она уже используется.' });
        if (!ok) return;
        try {
          await api(`/admin/reference/service-categories/${id}`, { method: 'DELETE' });
          await uiAlert({ title: 'Готово', message: 'Категория удалена.' });
          await loadCategories();
        } catch (e) {
          await uiAlert({ title: 'Не удалось', message: e.message });
        }
      });
    });
  }

  function renderScenarioDetail(sc) {
    const box = $('#scDetail');
    if (!box) return;
    if (!sc) {
      box.innerHTML = `<div class="empty">Выберите сценарий в таблице, чтобы редактировать вопросы и подсказки.</div>`;
      return;
    }
    const qs = (sc.questions || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const hs = (sc.hints || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
        <div>
          <h3 style="margin:0">${escapeHtml(sc.title)}</h3>
          <p class="muted" style="margin:0.25rem 0 0">${escapeHtml(sc.description || '')}</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          ${badge(sc.active ? 'active' : 'inactive', sc.active ? 'ok' : 'ghost')}
          <button type="button" class="btn btn--ghost btn-sm" id="scToggle">Вкл/Выкл</button>
          <button type="button" class="btn btn--ghost btn-sm" id="scEdit">Правка</button>
          <button type="button" class="btn btn--ghost btn-sm" id="scDelete">Удалить</button>
        </div>
      </div>

      <div class="grid-2" style="gap:1rem;margin-top:1rem">
        <div class="card" style="box-shadow:none">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
            <strong>Вопросы</strong>
            <button type="button" class="btn btn--ghost btn-sm" id="qAdd">+ вопрос</button>
          </div>
          <ul style="margin:0.5rem 0 0; padding-left:1.1rem">
            ${
              qs.length
                ? qs
                    .map(
                      (q) =>
                        `<li style="margin:0.35rem 0">
                          <span>${escapeHtml(q.text)}</span>
                          <small class="muted"> (order ${q.order ?? 0})</small>
                          <span style="display:inline-flex;gap:0.35rem;margin-left:0.5rem">
                            <button type="button" class="btn btn--ghost btn-sm qEdit" data-id="${q.id}">Правка</button>
                            <button type="button" class="btn btn--ghost btn-sm qDel" data-id="${q.id}">Удалить</button>
                          </span>
                        </li>`,
                    )
                    .join('')
                : `<li class="muted">Пока нет вопросов</li>`
            }
          </ul>
        </div>
        <div class="card" style="box-shadow:none">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
            <strong>Подсказки</strong>
            <button type="button" class="btn btn--ghost btn-sm" id="hAdd">+ подсказка</button>
          </div>
          <ul style="margin:0.5rem 0 0; padding-left:1.1rem">
            ${
              hs.length
                ? hs
                    .map(
                      (h) =>
                        `<li style="margin:0.35rem 0">
                          <span>${escapeHtml(h.text)}</span>
                          <small class="muted"> (order ${h.order ?? 0})</small>
                          <span style="display:inline-flex;gap:0.35rem;margin-left:0.5rem">
                            <button type="button" class="btn btn--ghost btn-sm hEdit" data-id="${h.id}">Правка</button>
                            <button type="button" class="btn btn--ghost btn-sm hDel" data-id="${h.id}">Удалить</button>
                          </span>
                        </li>`,
                    )
                    .join('')
                : `<li class="muted">Пока нет подсказок</li>`
            }
          </ul>
        </div>
      </div>
    `;
  }

  async function loadScenarios({ keepSelected = true } = {}) {
    const list = await api('/admin/reference/scenarios');
    const tbody = $('#scTable tbody');
    tbody.innerHTML = list
      .map(
        (s) => `<tr data-id="${s.id}" style="cursor:pointer">
        <td><strong>${escapeHtml(s.title)}</strong><div class="muted">${escapeHtml(s.description || '')}</div></td>
        <td>${badge(s.active ? 'да' : 'нет', s.active ? 'ok' : 'ghost')}</td>
        <td class="muted">${(s.questions || []).length}</td>
        <td class="muted">${(s.hints || []).length}</td>
        <td style="text-align:right"><button type="button" class="btn btn--ghost btn-sm scOpen" data-id="${s.id}">Открыть</button></td>
      </tr>`,
      )
      .join('');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty">Сценариев пока нет. Добавьте первый выше.</div></td></tr>`;
    }

    const prevId = keepSelected ? ($('#scDetail')?.dataset?.scid || '') : '';
    let selected = prevId ? list.find((x) => x.id === prevId) : null;
    if (!selected && list.length) selected = null;
    renderScenarioDetail(selected);

    tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const id = tr.dataset.id;
        const sc = list.find((x) => x.id === id);
        const box = $('#scDetail');
        if (box) box.dataset.scid = id;
        renderScenarioDetail(sc);
        tbody.querySelectorAll('tr[data-id]').forEach((x) => x.classList.toggle('is-selected', x.dataset.id === id));
        bindScenarioDetailActions(sc, list);
      });
    });

    // If user clicked Open button
    tbody.querySelectorAll('.scOpen').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const tr = b.closest('tr[data-id]');
        tr?.click();
      });
    });
  }

  function bindScenarioDetailActions(sc, list) {
    if (!sc) return;
    const box = $('#scDetail');
    if (!box) return;

    const refreshCurrent = async () => {
      scenariosCache = await api('/admin/reference/scenarios');
      const id = box.dataset.scid;
      const next = scenariosCache.find((x) => x.id === id);
      renderScenarioDetail(next || null);
      if (next) bindScenarioDetailActions(next, scenariosCache);
      const tbody = $('#scTable tbody');
      tbody?.querySelectorAll('tr[data-id]')?.forEach((tr) => {
        tr.classList.toggle('is-selected', tr.dataset.id === id);
      });
    };

    box.querySelector('#scToggle')?.addEventListener('click', async () => {
      await api(`/admin/reference/scenarios/${sc.id}`, { method: 'PATCH', body: { active: !sc.active } });
      await refreshCurrent();
    });
    box.querySelector('#scEdit')?.addEventListener('click', async () => {
      const title = await uiPromptText({ title: 'Правка сценария', label: 'Название', initialValue: sc.title });
      if (title == null) return;
      const description = await uiPromptText({
        title: 'Правка сценария',
        label: 'Описание (можно пусто)',
        initialValue: sc.description || '',
      });
      if (description == null) return;
      await api(`/admin/reference/scenarios/${sc.id}`, { method: 'PATCH', body: { title, description } });
      await refreshCurrent();
    });
    box.querySelector('#scDelete')?.addEventListener('click', async () => {
      const ok = await uiConfirm({ title: 'Удалить сценарий', message: 'Удалить сценарий вместе с вопросами/подсказками?' });
      if (!ok) return;
      await api(`/admin/reference/scenarios/${sc.id}`, { method: 'DELETE' });
      box.removeAttribute('data-scid');
      await loadScenarios({ keepSelected: false });
      renderScenarioDetail(null);
    });

    box.querySelector('#qAdd')?.addEventListener('click', async () => {
      const text = await uiPromptText({ title: 'Новый вопрос', label: 'Текст', placeholder: 'Например: Когда проявляется?' });
      if (text == null || !text.trim()) return;
      const orderRaw = await uiPromptText({ title: 'Новый вопрос', label: 'Порядок (число)', initialValue: '0' });
      if (orderRaw == null) return;
      const order = Number(orderRaw);
      await api(`/admin/reference/scenarios/${sc.id}/questions`, { method: 'POST', body: { text, order: Number.isFinite(order) ? order : 0 } });
      await refreshCurrent();
    });
    box.querySelector('#hAdd')?.addEventListener('click', async () => {
      const text = await uiPromptText({ title: 'Новая подсказка', label: 'Текст', placeholder: 'Например: Уточните пробег и ошибки' });
      if (text == null || !text.trim()) return;
      const orderRaw = await uiPromptText({ title: 'Новая подсказка', label: 'Порядок (число)', initialValue: '0' });
      if (orderRaw == null) return;
      const order = Number(orderRaw);
      await api(`/admin/reference/scenarios/${sc.id}/hints`, { method: 'POST', body: { text, order: Number.isFinite(order) ? order : 0 } });
      await refreshCurrent();
    });

    box.querySelectorAll('.qEdit').forEach((b) => {
      b.addEventListener('click', async () => {
        const qid = b.dataset.id;
        const q = (sc.questions || []).find((x) => x.id === qid);
        if (!q) return;
        const text = await uiPromptText({ title: 'Правка вопроса', label: 'Текст', initialValue: q.text });
        if (text == null || !text.trim()) return;
        const orderRaw = await uiPromptText({
          title: 'Правка вопроса',
          label: 'Порядок (число)',
          initialValue: String(q.order ?? 0),
        });
        if (orderRaw == null) return;
        const order = Number(orderRaw);
        await api(`/admin/reference/questions/${qid}`, { method: 'PATCH', body: { text, order: Number.isFinite(order) ? order : 0 } });
        await refreshCurrent();
      });
    });
    box.querySelectorAll('.qDel').forEach((b) => {
      b.addEventListener('click', async () => {
        const qid = b.dataset.id;
        const ok = await uiConfirm({ title: 'Удалить вопрос', message: 'Удалить вопрос из сценария?' });
        if (!ok) return;
        await api(`/admin/reference/questions/${qid}`, { method: 'DELETE' });
        await refreshCurrent();
      });
    });
    box.querySelectorAll('.hEdit').forEach((b) => {
      b.addEventListener('click', async () => {
        const hid = b.dataset.id;
        const h = (sc.hints || []).find((x) => x.id === hid);
        if (!h) return;
        const text = await uiPromptText({ title: 'Правка подсказки', label: 'Текст', initialValue: h.text });
        if (text == null || !text.trim()) return;
        const orderRaw = await uiPromptText({
          title: 'Правка подсказки',
          label: 'Порядок (число)',
          initialValue: String(h.order ?? 0),
        });
        if (orderRaw == null) return;
        const order = Number(orderRaw);
        await api(`/admin/reference/hints/${hid}`, { method: 'PATCH', body: { text, order: Number.isFinite(order) ? order : 0 } });
        await refreshCurrent();
      });
    });
    box.querySelectorAll('.hDel').forEach((b) => {
      b.addEventListener('click', async () => {
        const hid = b.dataset.id;
        const ok = await uiConfirm({ title: 'Удалить подсказку', message: 'Удалить подсказку из сценария?' });
        if (!ok) return;
        await api(`/admin/reference/hints/${hid}`, { method: 'DELETE' });
        await refreshCurrent();
      });
    });
  }

  async function loadMaterials() {
    const [cats, mats] = await Promise.all([
      api('/admin/reference/service-categories'),
      api('/admin/reference/reference-materials'),
    ]);
    catsCache = cats;
    matsCache = mats;

    $('#matCat').innerHTML =
      `<option value="">— без категории —</option>` +
      cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const tbody = $('#matTable tbody');
    const q = ($('#matQ')?.value || '').trim().toLowerCase();
    const filtered = q
      ? mats.filter(
          (m) =>
            String(m.title || '').toLowerCase().includes(q) ||
            String(m.body || '').toLowerCase().includes(q) ||
            String(m.category?.name || '').toLowerCase().includes(q),
        )
      : mats;
    tbody.innerHTML = filtered
      .map(
        (m) => `<tr data-id="${m.id}" style="cursor:pointer">
        <td><strong>${escapeHtml(m.title)}</strong></td>
        <td class="muted">${escapeHtml(m.category?.name || '—')}</td>
        <td style="text-align:right">
          <button type="button" class="btn btn--ghost btn-sm matOpen" data-id="${m.id}">Открыть</button>
          <button type="button" class="btn btn--ghost btn-sm matDel" data-id="${m.id}">Удалить</button>
        </td>
      </tr>`,
      )
      .join('');
    if (!filtered.length) {
      tbody.innerHTML = q
        ? `<tr><td colspan="3"><div class="empty">Ничего не найдено по запросу “${escapeHtml(q)}”.</div></td></tr>`
        : `<tr><td colspan="3"><div class="empty">Материалов пока нет. Добавьте первый выше.</div></td></tr>`;
    }

    function renderMatDetail(m) {
      const box = $('#matDetail');
      if (!box) return;
      if (!m) {
        box.innerHTML = `<div class="empty">Выберите материал в таблице, чтобы посмотреть или отредактировать.</div>`;
        return;
      }
      box.dataset.mid = m.id;
      const catOptions =
        `<option value="">— без категории —</option>` +
        catsCache.map((c) => `<option value="${c.id}" ${c.id === m.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">Материал</h3>
            <p class="muted" style="margin:0.25rem 0 0">ID: ${escapeHtml(m.id.slice(0, 8))}…</p>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button type="button" class="btn btn--primary btn-sm" id="matSave">Сохранить</button>
            <button type="button" class="btn btn--ghost btn-sm" id="matDelete">Удалить</button>
          </div>
        </div>
        <div class="grid-2" style="gap:1rem;margin-top:1rem">
          <div class="form-field" style="margin:0">
            <label for="matEditTitle">Заголовок</label>
            <input id="matEditTitle" value="${escapeHtml(m.title || '')}" />
          </div>
          <div class="form-field" style="margin:0">
            <label for="matEditCat">Категория</label>
            <select id="matEditCat">${catOptions}</select>
          </div>
        </div>
        <div class="form-field" style="margin-top:0.75rem">
          <label for="matEditBody">Текст</label>
          <textarea id="matEditBody" rows="6" placeholder="Коротко, по делу">${escapeHtml(m.body || '')}</textarea>
        </div>
        <p class="muted" style="margin:0">
          Подсказка: используйте списки и короткие фразы — это быстрее читается в консультации.
        </p>
      `;

      box.querySelector('#matSave')?.addEventListener('click', async () => {
        const title = String(box.querySelector('#matEditTitle')?.value || '').trim();
        const body = String(box.querySelector('#matEditBody')?.value || '').trim();
        const categoryId = String(box.querySelector('#matEditCat')?.value || '');
        if (!title || !body) {
          await uiAlert({ title: 'Проверьте поля', message: 'Нужно заполнить заголовок и текст материала.' });
          return;
        }
        await api(`/admin/reference/reference-materials/${m.id}`, {
          method: 'PATCH',
          body: { title, body, categoryId: categoryId || null },
        });
        await uiAlert({ title: 'Готово', message: 'Материал сохранён.' });
        await loadMaterials();
        const updated = matsCache.find((x) => x.id === m.id);
        if (updated) renderMatDetail(updated);
      });

      box.querySelector('#matDelete')?.addEventListener('click', async () => {
        const ok = await uiConfirm({ title: 'Удалить материал', message: 'Удалить справочный материал?' });
        if (!ok) return;
        await api(`/admin/reference/reference-materials/${m.id}`, { method: 'DELETE' });
        await uiAlert({ title: 'Готово', message: 'Материал удалён.' });
        box.removeAttribute('data-mid');
        await loadMaterials();
        renderMatDetail(null);
      });
    }

    tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const id = tr.dataset.id;
        const m = mats.find((x) => x.id === id);
        tbody.querySelectorAll('tr[data-id]').forEach((x) => x.classList.toggle('is-selected', x.dataset.id === id));
        renderMatDetail(m);
      });
    });
    tbody.querySelectorAll('.matOpen').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        b.closest('tr[data-id]')?.click();
      });
    });
    tbody.querySelectorAll('.matDel').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const ok = await uiConfirm({ title: 'Удалить материал', message: 'Удалить справочный материал?' });
        if (!ok) return;
        await api(`/admin/reference/reference-materials/${id}`, { method: 'DELETE' });
        await uiAlert({ title: 'Готово', message: 'Материал удалён.' });
        await loadMaterials();
      });
    });
  }

  // Bind create forms
  $('#catForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/admin/reference/service-categories', {
      method: 'POST',
      body: { name: fd.get('name'), description: fd.get('description') || undefined },
    });
    await uiAlert({ title: 'Готово', message: 'Категория создана.' });
    e.target.reset();
    await loadCategories();
  });

  $('#scForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/admin/reference/scenarios', {
      method: 'POST',
      body: { title: fd.get('title'), description: fd.get('description') || undefined },
    });
    await uiAlert({ title: 'Готово', message: 'Сценарий создан.' });
    e.target.reset();
    await loadScenarios({ keepSelected: false });
  });

  $('#matForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/admin/reference/reference-materials', {
      method: 'POST',
      body: {
        title: fd.get('title'),
        body: fd.get('body'),
        categoryId: fd.get('categoryId') || null,
      },
    });
    await uiAlert({ title: 'Готово', message: 'Материал создан.' });
    e.target.reset();
    await loadMaterials();
  });

  $('#btnReloadSummary')?.addEventListener('click', () => loadSummary());
  $('#btnReloadUsers')?.addEventListener('click', () => loadUsers());
  $('#adminUserQ')?.addEventListener('input', () => loadUsers());
  $('#btnReloadCats')?.addEventListener('click', () => loadCategories());
  $('#catQ')?.addEventListener('input', () => loadCategories());
  $('#btnReloadSc')?.addEventListener('click', () => loadScenarios({ keepSelected: true }));
  $('#btnReloadMat')?.addEventListener('click', () => loadMaterials());
  $('#matQ')?.addEventListener('input', () => loadMaterials());

  initTabs();
  await Promise.all([
    loadSummary(),
    loadUsers(),
    loadCategories(),
    (async () => {
      scenariosCache = await api('/admin/reference/scenarios');
      // render table using existing function
      await loadScenarios({ keepSelected: false });
    })(),
    loadMaterials(),
  ]);
}
