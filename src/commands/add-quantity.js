const { SlashCommandBuilder } = require('discord.js');
const { Item } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-quantity')
    .setDescription('زيادة كمية منتج موجود')
    .addStringOption(opt =>
      opt.setName('item').setDescription('اسم المنتج').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt =>
      opt.setName('quantity').setDescription('الكمية المراد إضافتها').setRequired(true).setMinValue(1)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const items = await Item.find({ name: new RegExp(focused, 'i') }).limit(25);
    await interaction.respond(items.map(i => ({ name: i.name, value: i.name })));
  },

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRoleId)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity');

    const item = await Item.findOne({ name });
    if (!item) return interaction.editReply({ content: `لم يتم العثور على منتج باسم **${name}**.` });

    item.quantity += quantity;
    await item.save();

    const logChannel = await interaction.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      const { logEmbed } = require('../utils/embeds');
      await logChannel.send({
        embeds: [logEmbed('إضافة كمية',
          `**المنتج:** ${name}\n**الكمية المضافة:** ${quantity}\n**الكمية الحالية:** ${item.quantity}\n**بواسطة:** <@${interaction.user.id}>`
        )]
      });
    }

    await interaction.editReply({ content: `تم إضافة **${quantity}** للمنتج **${name}**. الكمية الحالية: **${item.quantity}**` });
  }
};
