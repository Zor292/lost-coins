require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ─── Validate Environment ─────────────────────────────────────
const required = ['DISCORD_TOKEN', 'MONGODB_URI', 'SHOP_CATEGORY_ID', 'ADMIN_ROLE_ID', 'SHOP_LOG_CHANNEL_ID', 'PROBOT_ACCOUNT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Error] Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const PREFIX = '-';

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
  client.commands.set(command.name, command);
  if (command.aliases) {
    for (const alias of command.aliases) {
      client.commands.set(alias, command);
    }
  }
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

// ─── Prefix Command Handler ───────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (err) {
    console.error(`[Command Error] ${commandName}:`, err);
    await message.reply('حدث خطأ أثناء تنفيذ الأمر.').catch(() => null);
  }
});

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
