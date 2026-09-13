(function () {
  const contentEl = document.getElementById('content');
  const navEl = document.getElementById('nav');
  const guildEl = document.getElementById('guild-id');
  const userEl = document.getElementById('user-chip');

  let guildData = null;
  let modules = [];
  let activeId = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (res.status === 401) {
      location.href = '/';
      return null;
    }
    return res.json();
  }

  async function init() {
    const me = await api('/auth/me');
    if (!me) return;

    guildData = await api('/api/guild');
    renderTopbar(me.user);

    const modRes = await api('/api/modules');
    modules = modRes.modules;
    renderNav();

    if (modules.length) {
      selectModule(modules[0].id);
    } else {
      contentEl.innerHTML = '<div class="empty-state">Aucun fichier de configuration trouvé.</div>';
    }
  }

  function renderTopbar(user) {
    guildEl.innerHTML = guildData
      ? `
        <img src="${guildData.iconUrl || ''}" alt="" onerror="this.style.visibility='hidden'" />
        <div>
          <div class="name">${escapeHtml(guildData.name)}</div>
          <div class="members">${guildData.memberCount} membres</div>
        </div>
      `
      : '';

    userEl.innerHTML = `
      <span>${escapeHtml(user.username)}</span>
      <button id="logout-btn">Déconnexion</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      location.href = '/';
    });
  }

  function renderNav() {
    const byCategory = {};
    for (const m of modules) {
      byCategory[m.category] = byCategory[m.category] || [];
      byCategory[m.category].push(m);
    }
    let html = '';
    let delay = 0;
    for (const [category, mods] of Object.entries(byCategory)) {
      html += `<div class="nav-group"><div class="nav-group-title">${escapeHtml(category)}</div>`;
      for (const m of mods) {
        html += `
          <a href="#" class="nav-item" data-id="${m.id}" style="animation-delay:${delay}ms">
            <span class="icon">${m.icon || '🧩'}</span>
            <span>${escapeHtml(m.label)}</span>
          </a>`;
        delay += 18;
      }
      html += `</div>`;
    }
    navEl.innerHTML = html;
    navEl.querySelectorAll('.nav-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        selectModule(el.dataset.id);
      });
    });
  }

  function markActive(id) {
    navEl.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  async function selectModule(id) {
    activeId = id;
    markActive(id);
    contentEl.innerHTML = '<div class="empty-state">Chargement…</div>';
    const res = await api(`/api/modules/${id}`);
    if (!res) return;
    if (res.error) {
      contentEl.innerHTML = `<div class="empty-state">Erreur : ${escapeHtml(res.error)}</div>`;
      return;
    }
    const mod = res.module;
    if (mod.kind === 'leaderboard') {
      renderLeaderboard(mod, res.entries);
    } else if (mod.kind === 'raw') {
      renderRaw(mod, res.data);
    } else {
      renderSettingsForm(mod, res.data);
    }
  }

  function fieldRow(field, value) {
    const v = value === undefined || value === null ? '' : value;
    switch (field.type) {
      case 'toggle':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <label class="toggle">
              <input type="checkbox" data-key="${field.key}" ${v ? 'checked' : ''} />
              <span class="track"><span class="thumb"></span></span>
            </label>
          </div>`;
      case 'toggle_group':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <div class="toggle-group">
              ${field.subfields.map((sf) => `
                <div class="toggle-row">
                  <span>${escapeHtml(sf)}</span>
                  <label class="toggle">
                    <input type="checkbox" data-subkey="${field.key}.${sf}" ${value && value[sf] ? 'checked' : ''} />
                    <span class="track"><span class="thumb"></span></span>
                  </label>
                </div>`).join('')}
            </div>
          </div>`;
      case 'number':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <input type="number" data-key="${field.key}" value="${escapeHtml(v)}" />
          </div>`;
      case 'textarea':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <textarea data-key="${field.key}">${escapeHtml(v)}</textarea>
          </div>`;
      case 'select':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <select data-key="${field.key}">
              ${field.options.map((o) => `<option value="${escapeHtml(o)}" ${o === v ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
            </select>
          </div>`;
      case 'channel': {
        const channels = (guildData && guildData.channels) || [];
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <select data-key="${field.key}">
              <option value="">— Aucun —</option>
              ${channels.map((c) => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>#${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>`;
      }
      case 'color':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <input type="text" data-key="${field.key}" value="${escapeHtml(v)}" placeholder="#8B5CF6" />
          </div>`;
      case 'role_list':
        return `
          <div class="field">
            <label>${escapeHtml(field.label)}</label>
            <textarea data-key="${field.key}" data-list="true">${Array.isArray(value) ? value.join('\n') : ''}</textarea>
            <div class="hint">Un ID par ligne.</div>
          </div>`;
      case 'json':
      default:
        return `
          <div class="field">
            <label>${escapeHtml(field.label)} <span class="badge">JSON</span></label>
            <textarea data-key="${field.key}" data-json="true">${escapeHtml(JSON.stringify(value, null, 2))}</textarea>
          </div>`;
    }
  }

  function renderSettingsForm(mod, data) {
    const schema = mod.schema || null;
    // Le schema n'est pas renvoyé par l'API pour l'instant que via les champs
    // déjà connus côté serveur ; on redemande donc au serveur la liste des
    // champs à partir de la réponse précédente si présente, sinon on
    // reconstruit une vue brute.
    contentEl.innerHTML = `
      <h2>${escapeHtml(mod.label)}</h2>
      <p class="subtitle">Fichier : ${escapeHtml(mod.file || mod.id + '.json')}</p>
      <form id="mod-form"></form>
      <div class="actions">
        <button class="btn-save" id="save-btn">Sauvegarder</button>
        <span class="save-status" id="save-status"></span>
      </div>
    `;
    const formEl = document.getElementById('mod-form');
    const fields = mod.fields || Object.keys(data).map((k) => ({ key: k, label: k, type: guessType(data[k]) }));
    formEl.innerHTML = fields.map((f) => fieldRow(f, data[f.key])).join('');

    document.getElementById('save-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      await saveForm(mod, fields);
    });
  }

  function guessType(value) {
    if (typeof value === 'boolean') return 'toggle';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'role_list';
    if (typeof value === 'object' && value !== null) return 'json';
    return 'text';
  }

  async function saveForm(mod, fields) {
    const payload = {};
    for (const f of fields) {
      if (f.type === 'toggle_group') {
        const group = {};
        f.subfields.forEach((sf) => {
          const el = document.querySelector(`[data-subkey="${f.key}.${sf}"]`);
          group[sf] = !!(el && el.checked);
        });
        payload[f.key] = group;
        continue;
      }
      const el = document.querySelector(`[data-key="${f.key}"]`);
      if (!el) continue;
      if (f.type === 'toggle') {
        payload[f.key] = el.checked;
      } else if (f.type === 'number') {
        payload[f.key] = el.value === '' ? null : Number(el.value);
      } else if (el.dataset.list === 'true') {
        payload[f.key] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      } else if (el.dataset.json === 'true') {
        try {
          payload[f.key] = JSON.parse(el.value);
        } catch {
          setStatus('JSON invalide pour "' + f.key + '"', true);
          return;
        }
      } else {
        payload[f.key] = el.value;
      }
    }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    const res = await api(`/api/modules/${mod.id}`, { method: 'POST', body: JSON.stringify(payload) });
    saveBtn.disabled = false;
    if (res && res.ok) {
      setStatus('Modifications enregistrées.');
    } else {
      setStatus((res && res.error) || 'Échec de la sauvegarde.', true);
    }
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--danger)' : 'var(--teal)';
  }

  function renderLeaderboard(mod, entries) {
    const sorted = entries
      .slice()
      .sort((a, b) => {
        const va = typeof a.value.value === 'number' ? a.value.value : (a.value.xp || 0);
        const vb = typeof b.value.value === 'number' ? b.value.value : (b.value.xp || 0);
        return vb - va;
      })
      .slice(0, 50);

    const cols = sorted.length ? Object.keys(sorted[0].value) : [];

    contentEl.innerHTML = `
      <h2>${escapeHtml(mod.label)}</h2>
      <p class="subtitle">Classement en lecture seule — ${entries.length} entrées</p>
      ${sorted.length ? `
        <table class="leaderboard">
          <thead><tr><th>#</th><th>Utilisateur (ID)</th>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${sorted.map((e, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(e.userId)}</td>
                ${cols.map((c) => `<td>${escapeHtml(e.value[c])}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      ` : '<div class="empty-state">Aucune donnée pour le moment.</div>'}
    `;
  }

  function renderRaw(mod, data) {
    contentEl.innerHTML = `
      <h2>${escapeHtml(mod.label)}</h2>
      <p class="subtitle">Édition JSON avancée — ${escapeHtml(mod.file || '')}</p>
      <div class="field">
        <textarea id="raw-editor" style="min-height:360px; font-family: monospace;">${escapeHtml(JSON.stringify(data, null, 4))}</textarea>
      </div>
      <div class="actions">
        <button class="btn-save" id="save-raw-btn">Sauvegarder</button>
        <span class="save-status" id="save-status"></span>
      </div>
    `;
    document.getElementById('save-raw-btn').addEventListener('click', async () => {
      const el = document.getElementById('raw-editor');
      let parsed;
      try {
        parsed = JSON.parse(el.value);
      } catch {
        setStatus('JSON invalide.', true);
        return;
      }
      const res = await api(`/api/modules/${mod.id}`, { method: 'POST', body: JSON.stringify(parsed) });
      if (res && res.ok) setStatus('Modifications enregistrées.');
      else setStatus((res && res.error) || 'Échec de la sauvegarde.', true);
    });
  }

  init();
})();
