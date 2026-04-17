require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ─── Validate Environment ─────────────────────────────────────
const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'MONGODB_URI', 'SHOP_CATEGORY_ID', 'ADMIN_ROLE_ID', 'SHOP_LOG_CHANNEL_ID', 'PROBOT_ACCOUNT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Error] Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── Create Client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ─── Load Commands ────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data) client.commands.set(command.data.name, command);
}

// ─── Load Events ──────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ─── Connect Database ─────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MongoDB] Connected successfully');
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('[Startup Error]', err);
    process.exit(1);
  }
}

start();
