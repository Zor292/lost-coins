const { SlashCommandBuilder } = require('discord.js');
const { Item } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-item')
    .setDescription('إضافة منتج جديد للمتجر')
    .addStringOption(opt =>
      opt.setName('name').setDescription('اسم المنتج').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('price').setDescription('السعر بالـ لوست كوين').setRequired(true).setMinValue(1))
    .addIntegerOption(opt =>
      opt.setName('quantity').setDescription('الكمية المتاحة').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    // Check role
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!interaction.member.roles.cache.has(adminRoleId)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');
    const price = interaction.options.getInteger('price');
    const quantity = interaction.options.getInteger('quantity');

    const existing = await Item.findOne({ name });
    if (existing) {
      return interaction.editReply({ content: `منتج باسم **${name}** موجود بالفعل. استخدم \`/add-quantity\` لزيادة الكمية.` });
    }

    await Item.create({
      name,
      price,
      quantity,
      addedBy: interaction.user.id
    });

    // Log
    const logChannel = await interaction.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      const { logEmbed } = require('../utils/embeds');
      await logChannel.send({
        embeds: [logEmbed('إضافة منتج',
          `**المنتج:** ${name}\n**السعر:** ${price} لوست كوين\n**الكمية:** ${quantity}\n**أضيف بواسطة:** <@${interaction.user.id}>`
        )]
      });
    }

    await interaction.editReply({ content: `تم إضافة المنتج **${name}** بسعر **${price} لوست كوين** وكمية **${quantity}** بنجاح.` });
  }
};
