const { SlashCommandBuilder } = require('discord.js');
const { Item } = require('../models');
const { logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'additem',
  description: 'إضافة منتج جديد',

  slashData: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('إضافة منتج جديد للمتجر')
    .addStringOption(o => o.setName('اسم').setDescription('اسم المنتج').setRequired(true))
    .addIntegerOption(o => o.setName('سعر').setDescription('سعر المنتج بالكوينز').setMinValue(1).setRequired(true))
    .addIntegerOption(o => o.setName('كمية').setDescription('الكمية المتاحة').setMinValue(1).setRequired(true))
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    if (args.length < 3) return message.reply('الاستخدام: `-additem [اسم] [سعر] [كمية]`');
    const quantity = parseInt(args[args.length - 1]);
    const price = parseInt(args[args.length - 2]);
    const name = args.slice(0, args.length - 2).join(' ');
    if (!name || isNaN(price) || isNaN(quantity) || price < 1 || quantity < 1) {
      return message.reply('تأكد من إدخال اسم صحيح، سعر وكمية أكبر من 0.');
    }
    const result = await handleAddItem(message.guild, message.author, name, price, quantity);
    if (!result.success) return message.reply(result.error);
    await message.reply(`تم إضافة المنتج **${name}** بسعر **${price} لوست كوين** وكمية **${quantity}** بنجاح.`);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    const name = interaction.options.getString('اسم');
    const price = interaction.options.getInteger('سعر');
    const quantity = interaction.options.getInteger('كمية');
    const result = await handleAddItem(interaction.guild, interaction.user, name, price, quantity);
    if (!result.success) return interaction.reply({ content: result.error, ephemeral: true });
    await interaction.reply({ content: `تم إضافة المنتج **${name}** بسعر **${price} لوست كوين** وكمية **${quantity}** بنجاح.` });
  }
};

async function handleAddItem(guild, author, name, price, quantity) {
  const existing = await Item.findOne({ name });
  if (existing) return { success: false, error: `منتج باسم **${name}** موجود بالفعل.` };
  await Item.create({ name, price, quantity, addedBy: author.id });
  const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) {
    await logChannel.send({
      embeds: [logEmbed('إضافة منتج',
        `**المنتج:** ${name}\n**السعر:** ${price} لوست كوين\n**الكمية:** ${quantity}\n**أضيف بواسطة:** <@${author.id}>`
      )]
    });
  }
  return { success: true };
}
