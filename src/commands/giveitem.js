const { SlashCommandBuilder } = require('discord.js');
const { Item, Transaction } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'giveitem',
  description: 'إهداء منتج لعضو',

  slashData: new SlashCommandBuilder()
    .setName('giveitem')
    .setDescription('إهداء منتج لعضو')
    .addUserOption(o => o.setName('عضو').setDescription('العضو المراد إهداؤه').setRequired(true))
    .addStringOption(o => o.setName('منتج').setDescription('اسم المنتج').setRequired(true))
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('يرجى ذكر العضو.');
    const name = args.slice(1).join(' ');
    if (!name) return message.reply('يرجى ذكر اسم المنتج.');
    const result = await handleGiveItem(message.guild, message.author, targetUser, name);
    if (!result.success) return message.reply(result.error);
    await message.reply(`تم إهداء **${name}** للعضو <@${targetUser.id}> بنجاح.`);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const targetUser = interaction.options.getUser('عضو');
    const name = interaction.options.getString('منتج');
    const result = await handleGiveItem(interaction.guild, interaction.user, targetUser, name);
    if (!result.success) return interaction.reply({ content: result.error, ephemeral: true });
    await interaction.reply({ content: `تم إهداء **${name}** للعضو <@${targetUser.id}> بنجاح.` });
  }
};

async function handleGiveItem(guild, author, targetUser, name) {
  const item = await Item.findOne({ name });
  if (!item) return { success: false, error: `لم يتم العثور على منتج باسم **${name}**.` };
  if (item.quantity <= 0) return { success: false, error: `نفد مخزون المنتج **${name}**.` };
  item.quantity -= 1;
  item.soldCount += 1;
  await item.save();
  await Transaction.create({ userId: targetUser.id, username: targetUser.username, type: 'item_given', itemName: item.name, itemPrice: 0, performedBy: author.id });
  try {
    await targetUser.send({ embeds: [invoiceEmbed('item_given', { itemName: item.name, givenBy: `<@${author.id}>` })] });
  } catch {}
  const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed('إهداء منتج',
        `**المنتج:** ${name}\n**المستلم:** <@${targetUser.id}>\n**أُهدي بواسطة:** <@${author.id}>`
      )]
    });
  }
  return { success: true };
}
