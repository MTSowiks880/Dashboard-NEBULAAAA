// dashboard/routes/api.js
const express = require('express');
const { getGuildId } = require('../lib/auth');
const { getModuleList, readJson, writeJson, DATA_VIEWS } = require('../lib/modules');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

function buildApiRouter(client, { dataDir }) {
  const router = express.Router();
  router.use(requireAuth);

  // Infos du serveur affichées en haut du dashboard
  router.get('/guild', (req, res) => {
    const guildId = getGuildId(client);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });
    res.json({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }) || null,
      memberCount: guild.memberCount,
      channels: guild.channels.cache
        .filter((c) => c.isTextBased?.() && !c.isThread?.())
        .map((c) => ({ id: c.id, name: c.name })),
      roles: guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
    });
  });

  // Liste des modules (sidebar)
  router.get('/modules', (req, res) => {
    try {
      const modules = getModuleList(dataDir).map((m) => ({
        id: m.id,
        label: m.label,
        icon: m.icon,
        category: m.category,
        kind: m.kind,
        auto: !!m.auto,
      }));
      res.json({ modules });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Détail d'un module (schema + valeurs actuelles, ou données brutes)
  router.get('/modules/:id', (req, res) => {
    const modules = getModuleList(dataDir);
    const mod = modules.find((m) => m.id === req.params.id);
    if (!mod) return res.status(404).json({ error: 'module_not_found' });

    if (mod.kind === 'error') {
      return res.status(500).json({ error: mod.error });
    }

    try {
      const data = readJson(dataDir, mod.file);
      if (mod.kind === 'leaderboard') {
        const rootKey = mod.rootKey;
        const entries = Object.entries(data[rootKey] || {}).map(([userId, value]) => ({
          userId,
          value: typeof value === 'object' ? value : { value },
        }));
        return res.json({ module: mod, entries });
      }
      // settings ou raw -> renvoie le schema (si présent) + les données
      return res.json({ module: mod, data });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Sauvegarde d'un module "settings" (formulaire connu ou auto-généré)
  router.post('/modules/:id', (req, res) => {
    const modules = getModuleList(dataDir);
    const mod = modules.find((m) => m.id === req.params.id);
    if (!mod) return res.status(404).json({ error: 'module_not_found' });
    if (mod.kind !== 'settings' && mod.kind !== 'raw') {
      return res.status(400).json({ error: 'module_not_editable' });
    }

    try {
      const current = readJson(dataDir, mod.file);
      const incoming = req.body;

      let merged;
      if (Array.isArray(current)) {
        // Fichier racine = tableau -> on remplace entièrement (édition JSON brute)
        merged = incoming;
      } else {
        merged = { ...current, ...incoming };
      }

      writeJson(dataDir, mod.file, merged);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) });
    }
  });

  return router;
}

module.exports = { buildApiRouter };
