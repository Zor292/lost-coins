const { SlashCommandBuilder } = require('discord.js');
const { User } = require('../models');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'coins'],
  description: 'عرض رصيد اللوست كوين',

  slashData: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('عرض رصيد اللوست كوين')
    .addUserOption(o => o.setName('عضو').setDescription('عضو آخر (للإدارة فقط)').setRequired(false))
    .toJSON(),

  async execute(message, args, client) {
    const isAdmin = message.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
    let target = message.author;
    const mentioned = message.mentions.users.first();
    if (mentioned) {
      if (!isAdmin) return message.reply('ليس لديك صلاحية عرض رصيد الآخرين.');
      target = mentioned;
    }
    const embed = await buildBalanceEmbed(target);
    await message.reply({ embeds: [embed] });
  },

  async executeSlash(interaction, client) {
    const isAdmin = interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
    let target = interaction.user;
    const mentioned = interaction.options.getUser('عضو');
    if (mentioned) {
      if (!isAdmin) return interaction.reply({ content: 'ليس لديك صلاحية عرض رصيد الآخرين.', ephemeral: true });
      target = mentioned;
    }
    const embed = await buildBalanceEmbed(target);
    await interaction.reply({ embeds: [embed] });
  }
};

async function buildBalanceEmbed(target) {
  let userData = await User.findOne({ userId: target.id });
  if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });
  return baseEmbed()
    .setTitle('رصيد اللوست كوين')
    .setDescription(`**العضو:** <@${target.id}>\n**الرصيد:** \`${userData.lostCoins} لوست كوين\``);
}
