// dashboard/index.js
// Attache un dashboard web (style Carlbot / Sapphire) au bot Discord existant.
//
// Utilisation dans index.js du bot :
//
//   const attachDashboard = require('./dashboard');
//   client.once('ready', () => {
//     attachDashboard(client, { port: process.env.DASHBOARD_PORT || 3000 });
//   });
//
// Variables d'environnement nécessaires (à ajouter dans .env) :
//   DISCORD_CLIENT_ID       -> Application ID (Discord Developer Portal)
//   DISCORD_CLIENT_SECRET   -> Client Secret (Developer Portal > OAuth2)
//   DISCORD_REDIRECT_URI    -> ex: https://nebula.hatenna.com/auth/callback
//   SESSION_SECRET          -> chaîne aléatoire longue, pour signer les cookies
//   DASHBOARD_GUILD_ID      -> (optionnel) force un serveur précis si le bot
//                              tourne sur plusieurs serveurs
//
// Le token du bot (process.env.TOKEN) est réutilisé tel quel.

const path = require('path');
const express = require('express');
const session = require('express-session');

const { buildAuthRouter } = require('./lib/auth');
const { buildApiRouter } = require('./routes/api');

function attachDashboard(client, options = {}) {
  const app = express();
  const port = options.port || process.env.DASHBOARD_PORT || 3000;
  const dataDir = options.dataDir || process.cwd();

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    console.warn('[dashboard] DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_REDIRECT_URI manquants dans .env — le login OAuth2 ne fonctionnera pas.');
  }

  app.use(express.json());
  app.use(
    session({
      name: 'nebula.sid',
      secret: process.env.SESSION_SECRET || 'change-me-please',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );

  // Routes d'authentification (login, callback, logout)
  app.use('/auth', buildAuthRouter(client));

  // API du dashboard (protégée — nécessite une session admin valide)
  app.use('/api', buildApiRouter(client, { dataDir }));

  // Fichiers statiques (HTML/CSS/JS de l'interface)
  app.use(express.static(path.join(__dirname, 'public')));

  // Toute route inconnue qui n'est ni /api ni /auth retombe sur l'app statique
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`[dashboard] Interface disponible sur le port ${port}`);
  });

  return app;
}

module.exports = attachDashboard;
