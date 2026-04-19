const { SlashCommandBuilder } = require('discord.js');
const { User, Transaction } = require('../models');
const { logEmbed, baseEmbed } = require('../utils/embeds');

module.exports = {
  name: 'addcoins',
  aliases: ['add-coins'],
  description: 'إضافة كوينز لعضو',

  slashData: new SlashCommandBuilder()
    .setName('addcoins')
    .setDescription('إضافة كوينز لعضو')
    .addUserOption(o => o.setName('عضو').setDescription('العضو المراد إضافة الكوينز له').setRequired(true))
    .addIntegerOption(o => o.setName('كمية').setDescription('عدد الكوينز').setMinValue(1).setRequired(true))
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    const target = message.mentions.users.first();
    if (!target) return message.reply('يرجى ذكر العضو. مثال: `-addcoins @user 10`');
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1) return message.reply('يرجى إدخال كمية صحيحة أكبر من 0.');
    await handleAddCoins(message.guild, message.channel, message.author, target, amount);
    await message.reply(`تم إضافة **${amount} لوست كوين** لـ <@${target.id}>.`);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const target = interaction.options.getUser('عضو');
    const amount = interaction.options.getInteger('كمية');
    const userData = await handleAddCoins(interaction.guild, interaction.channel, interaction.user, target, amount);
    await interaction.reply({ content: `تم إضافة **${amount} لوست كوين** لـ <@${target.id}>. رصيده الحالي: **${userData.lostCoins} لوست كوين**` });
  }
};

async function handleAddCoins(guild, channel, author, target, amount) {
  let userData = await User.findOne({ userId: target.id });
  if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });
  userData.lostCoins += amount;
  await userData.save();

  await Transaction.create({ userId: target.id, username: target.username, type: 'coins_added', coinsAmount: amount, performedBy: author.id });

  try {
    const dm = baseEmbed()
      .setTitle('إضافة لوست كوين')
      .setDescription(
        `تمت إضافة كوينز لحسابك\n\n` +
        `**الكمية المضافة:** ${amount} لوست كوين\n` +
        `**رصيدك الحالي:** ${userData.lostCoins} لوست كوين\n` +
        `**بواسطة:** <@${author.id}>\n` +
        `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
      );
    await target.send({ embeds: [dm] });
  } catch {}

  const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed('إضافة كوينز يدوية',
        `**العضو:** <@${target.id}>\n**الكمية المضافة:** ${amount} لوست كوين\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين\n**بواسطة:** <@${author.id}>`
      )]
    });
  }
  return userData;
}
