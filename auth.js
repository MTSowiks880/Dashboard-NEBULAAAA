// dashboard/lib/auth.js
// Gère le login "Se connecter avec Discord" (OAuth2) et vérifie que
// l'utilisateur a bien la permission "Gérer le serveur" sur le serveur du bot.

const express = require('express');
const { PermissionsBitField } = require('discord.js');

const OAUTH_BASE = 'https://discord.com/api/oauth2';
const API_BASE = 'https://discord.com/api/v10';

function getGuildId(client) {
  if (process.env.DASHBOARD_GUILD_ID) return process.env.DASHBOARD_GUILD_ID;
  const first = client.guilds.cache.first();
  return first ? first.id : null;
}

function buildAuthRouter(client) {
  const router = express.Router();

  router.get('/login', (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds',
      prompt: 'consent',
    });
    res.redirect(`${OAUTH_BASE}/authorize?${params.toString()}`);
  });

  router.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=missing_code');

    try {
      const tokenRes = await fetch(`${OAUTH_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
      const tokenData = await tokenRes.json();

      const userRes = await fetch(`${API_BASE}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) throw new Error(`user fetch failed: ${userRes.status}`);
      const user = await userRes.json();

      const guildId = getGuildId(client);
      const guild = guildId ? client.guilds.cache.get(guildId) : null;
      if (!guild) throw new Error('bot not in any guild / DASHBOARD_GUILD_ID invalide');

      let member;
      try {
        member = await guild.members.fetch(user.id);
      } catch {
        return res.redirect('/?error=not_in_server');
      }

      const isAdmin =
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        member.permissions.has(PermissionsBitField.Flags.ManageGuild);

      if (!isAdmin) {
        return res.redirect('/?error=no_permission');
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        guildId: guild.id,
      };

      res.redirect('/dashboard.html');
    } catch (err) {
      console.error('[dashboard] auth callback error:', err);
      res.redirect('/?error=auth_failed');
    }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'not_authenticated' });
    res.json({ user: req.session.user });
  });

  return router;
}

module.exports = { buildAuthRouter, getGuildId };
