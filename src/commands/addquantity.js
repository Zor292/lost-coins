const { SlashCommandBuilder } = require('discord.js');
const { Item } = require('../models');
const { logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'addquantity',
  description: 'زيادة كمية منتج',

  slashData: new SlashCommandBuilder()
    .setName('addquantity')
    .setDescription('زيادة كمية منتج موجود')
    .addStringOption(o => o.setName('اسم').setDescription('اسم المنتج').setRequired(true))
    .addIntegerOption(o => o.setName('كمية').setDescription('الكمية المراد إضافتها').setMinValue(1).setRequired(true))
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    if (args.length < 2) return message.reply('الاستخدام: `-addquantity [اسم المنتج] [الكمية]`');
    const quantity = parseInt(args[args.length - 1]);
    const name = args.slice(0, args.length - 1).join(' ');
    if (!name || isNaN(quantity) || quantity < 1) return message.reply('تأكد من إدخال اسم صحيح وكمية أكبر من 0.');
    const result = await handleAddQuantity(message.guild, message.author, name, quantity);
    if (!result.success) return message.reply(result.error);
    await message.reply(`تم إضافة **${quantity}** للمنتج **${name}**. الكمية الحالية: **${result.item.quantity}**`);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const name = interaction.options.getString('اسم');
    const quantity = interaction.options.getInteger('كمية');
    const result = await handleAddQuantity(interaction.guild, interaction.user, name, quantity);
    if (!result.success) return interaction.reply({ content: result.error, ephemeral: true });
    await interaction.reply({ content: `تم إضافة **${quantity}** للمنتج **${name}**. الكمية الحالية: **${result.item.quantity}**` });
  }
};

async function handleAddQuantity(guild, author, name, quantity) {
  const item = await Item.findOne({ name });
  if (!item) return { success: false, error: `لم يتم العثور على منتج باسم **${name}**.` };
  item.quantity += quantity;
  await item.save();
  const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed('إضافة كمية',
        `**المنتج:** ${name}\n**الكمية المضافة:** ${quantity}\n**الكمية الحالية:** ${item.quantity}\n**بواسطة:** <@${author.id}>`
      )]
    });
  }
  return { success: true, item };
}
