require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const required = ['DISCORD_TOKEN', 'MONGODB_URI', 'SHOP_CATEGORY_ID', 'ADMIN_ROLE_ID', 'SHOP_LOG_CHANNEL_ID', 'PROBOT_ACCOUNT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

const PREFIX = '-';

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

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const slashData = [];

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.name, command);
  if (command.aliases) {
    for (const alias of command.aliases) {
      client.commands.set(alias, command);
    }
  }
  if (command.slashData) {
    slashData.push(command.slashData);
  }
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

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
    console.error('[Prefix Error]', err);
    await message.reply('حدث خطأ أثناء تنفيذ الأمر.').catch(() => null);
  }
});

async function deploySlashCommands() {
  if (!process.env.CLIENT_ID) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: slashData }
      );
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: slashData }
      );
    }
    console.log('[Slash] Commands deployed');
  } catch (err) {
    console.error('[Slash Deploy Error]', err);
  }
}

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MongoDB] Connected');
    await client.login(process.env.DISCORD_TOKEN);
    await deploySlashCommands();
  } catch (err) {
    console.error('[Startup Error]', err);
    process.exit(1);
  }
}

start();
