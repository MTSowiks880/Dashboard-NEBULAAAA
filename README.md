# Dashboard Nebula

Un dashboard web façon Carlbot / Sapphire pour ton bot **Nebula**, avec
connexion Discord (OAuth2), et une page de réglages générée automatiquement
pour **chacun** de tes fichiers `.json` de configuration à la racine du bot
(welcome, antispam, antinuke, économie, niveaux, etc.) — y compris ceux
qu'on n'a pas décrits à la main : le dashboard lit leur structure et
construit un formulaire tout seul.

## 1. Installation

Copie le dossier `dashboard/` à la racine de ton projet bot (à côté de
`index.js`), puis installe les deux dépendances manquantes :

```bash
npm install express express-session
```

## 2. Créer l'application Discord (pour le login)

1. Va sur https://discord.com/developers/applications et ouvre **ton
   application existante** (celle du bot Nebula).
2. Onglet **OAuth2** :
   - note le **Client ID** et le **Client Secret**.
   - dans **Redirects**, ajoute :
     `https://nebula.hatenna.com/auth/callback`
     (remplace par ton domaine si besoin — vu ta capture, tu as déjà
     `nebula.hatenna.com` en CNAME, donc c'est probablement la bonne URL).

## 3. Variables d'environnement

Ajoute ces lignes dans ton `.env` existant (ne touche à rien d'autre) :

```
DISCORD_CLIENT_ID=xxxxxxxxxxxxxxxxxx
DISCORD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_REDIRECT_URI=https://nebula.hatenna.com/auth/callback
SESSION_SECRET=une-longue-chaine-aleatoire
DASHBOARD_PORT=3000
# Optionnel si le bot tourne sur plusieurs serveurs :
# DASHBOARD_GUILD_ID=123456789012345678
```

`TOKEN` (le token du bot) n'a pas besoin d'être dupliqué : le dashboard
utilise directement le client Discord déjà connecté par ton bot.

## 4. Brancher le dashboard dans `index.js`

Ajoute ces deux lignes dans ton `index.js`, une fois que `client` est prêt :

```js
const attachDashboard = require('./dashboard');

client.once('ready', () => {
  attachDashboard(client, { port: process.env.DASHBOARD_PORT || 3000 });
});
```

Redémarre le bot. Le dashboard est alors servi sur le port choisi (3000 par
défaut) — configure ton reverse proxy / la plateforme d'hébergement pour
pointer `nebula.hatenna.com` vers ce port.

## 5. Utilisation

- Va sur `https://nebula.hatenna.com/` → **Se connecter avec Discord**.
- Seuls les membres avec la permission **Gérer le serveur** (ou
  Administrateur) peuvent entrer.
- La barre latérale liste tous les modules détectés, groupés par catégorie
  (Serveur, Modération, Progression, Autre…).
- Les modules avec un formulaire connu (Bienvenue, Anti-spam, Anti-nuke)
  ont des champs propres (salon, rôle, interrupteurs…).
- Tous les autres fichiers `.json` obtiennent un formulaire généré
  automatiquement à partir de leurs clés.
- `levels.json` et `economy.json` s'affichent en classement (lecture
  seule) plutôt qu'en formulaire, puisque ce sont des données de joueurs,
  pas des réglages.
- `database.json` (avertissements / logs de modération) s'ouvre dans un
  éditeur JSON avancé, en lecture/écriture directe.

## Limites à connaître

- Le dashboard lit/écrit les mêmes fichiers `.json` que le bot. Si le bot
  et le dashboard écrivent au même moment, la dernière écriture gagne — il
  n'y a pas de verrou de fichier. Pour un usage perso sur un seul serveur,
  ce n'est généralement pas un problème.
- Les formulaires auto-générés ne couvrent que les clés de premier niveau ;
  les objets ou tableaux complexes s'éditent en JSON brut dans le même
  formulaire (un champ `"JSON"` apparaît à côté du libellé).
- Il n'y a qu'un seul serveur géré à la fois (celui du bot, ou celui fixé
  par `DASHBOARD_GUILD_ID`) — ce dashboard n'est pas multi-serveurs comme
  Carlbot/Sapphire, puisque ton bot ne semble pas stocker de configuration
  par serveur (les fichiers JSON sont à plat, pas classés par `guildId`).
