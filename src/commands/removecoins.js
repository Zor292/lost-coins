const { SlashCommandBuilder } = require('discord.js');
const { User, Transaction } = require('../models');
const { logEmbed, baseEmbed } = require('../utils/embeds');

module.exports = {
  name: 'removecoins',
  aliases: ['remove-coins'],
  description: 'خصم كوينز من عضو',

  slashData: new SlashCommandBuilder()
    .setName('removecoins')
    .setDescription('خصم كوينز من عضو')
    .addUserOption(o => o.setName('عضو').setDescription('العضو المراد خصم الكوينز منه').setRequired(true))
    .addIntegerOption(o => o.setName('كمية').setDescription('عدد الكوينز').setMinValue(1).setRequired(true))
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    const target = message.mentions.users.first();
    if (!target) return message.reply('يرجى ذكر العضو. مثال: `-removecoins @user 10`');
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1) return message.reply('يرجى إدخال كمية صحيحة أكبر من 0.');
    const result = await handleRemoveCoins(message.guild, message.author, target, amount);
    if (!result.success) return message.reply(result.error);
    await message.reply(`تم خصم **${amount} لوست كوين** من <@${target.id}>. رصيده الحالي: **${result.userData.lostCoins} لوست كوين**`);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const target = interaction.options.getUser('عضو');
    const amount = interaction.options.getInteger('كمية');
    const result = await handleRemoveCoins(interaction.guild, interaction.user, target, amount);
    if (!result.success) return interaction.reply({ content: result.error, ephemeral: true });
    await interaction.reply({ content: `تم خصم **${amount} لوست كوين** من <@${target.id}>. رصيده الحالي: **${result.userData.lostCoins} لوست كوين**` });
  }
};

async function handleRemoveCoins(guild, author, target, amount) {
  let userData = await User.findOne({ userId: target.id });
  if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });

  if (userData.lostCoins < amount) {
    return { success: false, error: `رصيد العضو غير كافٍ. رصيده الحالي: **${userData.lostCoins} لوست كوين**` };
  }

  userData.lostCoins -= amount;
  await userData.save();

  await Transaction.create({ userId: target.id, username: target.username, type: 'coins_removed', coinsAmount: amount, performedBy: author.id });

  try {
    const dm = baseEmbed()
      .setTitle('خصم لوست كوين')
      .setDescription(
        `تم خصم كوينز من حسابك\n\n` +
        `**الكمية المخصومة:** ${amount} لوست كوين\n` +
        `**رصيدك الحالي:** ${userData.lostCoins} لوست كوين\n` +
        `**بواسطة:** <@${author.id}>\n` +
        `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
      );
    await target.send({ embeds: [dm] });
  } catch {}

  const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed('خصم كوينز يدوي',
        `**العضو:** <@${target.id}>\n**الكمية المخصومة:** ${amount} لوست كوين\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين\n**بواسطة:** <@${author.id}>`
      )]
    });
  }
  return { success: true, userData };
}
