// dashboard/lib/modules.js
// Registre des modules du bot affichés dans le dashboard.
//
// Pour les fichiers dont on connaît la structure exacte, on définit un
// "schema" (liste de champs typés) => formulaire propre.
// Pour tous les autres fichiers *.json trouvés à la racine du bot, on
// génère un formulaire automatiquement à partir des clés de premier niveau
// (bool -> interrupteur, number -> champ numérique, string -> champ texte,
// tableau/objet -> éditeur JSON brut) afin que TOUS les modules soient
// gérables depuis le dashboard, même sans schema écrit à la main.

const fs = require('fs');
const path = require('path');

// Fichiers à ne jamais exposer tels quels (secrets, cache technique, etc.)
const EXCLUDED_FILES = new Set([
  'package.json',
  'package-lock.json',
  '.env',
]);

// Schémas "faits main" pour les modules dont la structure est connue.
// type: 'toggle' | 'number' | 'text' | 'textarea' | 'color' | 'channel' | 'role_list' | 'json'
const KNOWN_SCHEMAS = {
  'welcome.json': {
    label: 'Bienvenue',
    icon: '👋',
    category: 'Serveur',
    fields: [
      { key: 'channelId', label: 'Salon de bienvenue', type: 'channel' },
      { key: 'message', label: 'Message', type: 'textarea' },
      { key: 'imageUrl', label: "Image / GIF (URL)", type: 'text' },
      { key: 'footer', label: 'Texte du pied de page', type: 'text' },
      { key: 'color', label: 'Couleur de l\'embed', type: 'color' },
    ],
  },
  'antispam.json': {
    label: 'Anti-spam',
    icon: '🛡️',
    category: 'Modération',
    fields: [
      { key: 'enabled', label: 'Activé', type: 'toggle' },
      { key: 'maxMessages', label: 'Messages max avant sanction', type: 'number' },
      { key: 'windowMs', label: "Fenêtre de temps (ms)", type: 'number' },
      { key: 'timeoutMs', label: 'Durée du timeout (ms, 0 = aucun)', type: 'number' },
      { key: 'logChannelId', label: 'Salon de logs', type: 'channel' },
      { key: 'whitelistRoleIds', label: 'Rôles exemptés', type: 'role_list' },
    ],
  },
  'antinuke.json': {
    label: 'Anti-nuke',
    icon: '🚨',
    category: 'Modération',
    fields: [
      { key: 'enabled', label: 'Activé', type: 'toggle' },
      {
        key: 'punishment',
        label: 'Sanction appliquée',
        type: 'select',
        options: ['striproles', 'kick', 'ban', 'quarantine'],
      },
      { key: 'thresholdCount', label: "Nombre d'actions suspectes toléré", type: 'number' },
      { key: 'thresholdWindowMs', label: 'Fenêtre de détection (ms)', type: 'number' },
      { key: 'logChannelId', label: 'Salon de logs', type: 'channel' },
      { key: 'whitelistUserIds', label: 'Utilisateurs exemptés (IDs)', type: 'role_list' },
      {
        key: 'monitor',
        label: 'Événements surveillés',
        type: 'toggle_group',
        subfields: [
          'channeldelete',
          'channelcreate',
          'roledelete',
          'rolecreate',
          'ban',
          'kick',
          'webhook',
          'botadd',
          'permissions',
        ],
      },
    ],
  },
};

// Fichiers traités comme des données (classement / historique) plutôt que
// des réglages : on affiche un tableau en lecture + un accès "édition avancée".
const DATA_VIEWS = {
  'levels.json': { label: 'Niveaux', icon: '⭐', category: 'Progression', kind: 'leaderboard', rootKey: 'users', columns: ['xp', 'level'] },
  'economy.json': { label: 'Économie', icon: '💰', category: 'Progression', kind: 'leaderboard', rootKey: 'balances', columns: [] },
  'database.json': { label: 'Modération (historique)', icon: '📋', category: 'Modération', kind: 'raw' },
};

const CATEGORY_ORDER = ['Serveur', 'Modération', 'Progression', 'Communauté', 'Fun', 'Utilitaire', 'Autre'];

function humanizeFilename(file) {
  const name = file.replace(/\.json$/, '');
  const spaced = name.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function guessField(key, value) {
  if (typeof value === 'boolean') return { key, label: key, type: 'toggle' };
  if (typeof value === 'number') return { key, label: key, type: 'number' };
  if (typeof value === 'string') {
    return { key, label: key, type: value.length > 60 ? 'textarea' : 'text' };
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return { key, label: key, type: 'role_list' };
  }
  // objets imbriqués / tableaux complexes -> édition JSON brute pour ce champ
  return { key, label: key, type: 'json' };
}

function buildAutoSchema(file, data) {
  const fields = Object.keys(data || {}).map((k) => guessField(k, data[k]));
  return {
    label: humanizeFilename(file),
    icon: '🧩',
    category: 'Autre',
    auto: true,
    fields,
  };
}

function listConfigFiles(dataDir) {
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith('.json') && !EXCLUDED_FILES.has(f));
}

function readJson(dataDir, file) {
  const full = path.join(dataDir, file);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function writeJson(dataDir, file, data) {
  const full = path.join(dataDir, file);
  fs.writeFileSync(full, JSON.stringify(data, null, 4), 'utf8');
}

// Construit la liste complète des modules disponibles (schema connu, vue
// données, ou schema auto-généré), en essayant chaque fichier séparément
// pour qu'un fichier corrompu n'empêche pas les autres de s'afficher.
function getModuleList(dataDir) {
  const files = listConfigFiles(dataDir);
  const modules = [];

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    if (DATA_VIEWS[file]) {
      modules.push({ id, file, ...DATA_VIEWS[file] });
      continue;
    }
    if (KNOWN_SCHEMAS[file]) {
      modules.push({ id, file, kind: 'settings', ...KNOWN_SCHEMAS[file] });
      continue;
    }
    try {
      const data = readJson(dataDir, file);
      if (Array.isArray(data)) {
        modules.push({ id, file, label: humanizeFilename(file), icon: '🧩', category: 'Autre', kind: 'raw' });
      } else {
        modules.push({ id, file, kind: 'settings', ...buildAutoSchema(file, data) });
      }
    } catch (err) {
      modules.push({ id, file, label: humanizeFilename(file), icon: '⚠️', category: 'Autre', kind: 'error', error: String(err.message || err) });
    }
  }

  modules.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category) === -1 ? 99 : CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category) === -1 ? 99 : CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.label.localeCompare(b.label);
  });

  return modules;
}

module.exports = {
  getModuleList,
  readJson,
  writeJson,
  listConfigFiles,
  KNOWN_SCHEMAS,
  DATA_VIEWS,
};
