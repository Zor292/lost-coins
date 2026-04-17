const { SlashCommandBuilder } = require('discord.js');
const { Item, Transaction } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give-item')
    .setDescription('إهداء منتج لعضو')
    .addUserOption(opt =>
      opt.setName('user').setDescription('العضو المراد إهداؤه').setRequired(true))
    .addStringOption(opt =>
      opt.setName('item').setDescription('اسم المنتج').setRequired(true).setAutocomplete(true)),

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

    const targetUser = interaction.options.getUser('user');
    const itemName = interaction.options.getString('item');

    const item = await Item.findOne({ name: itemName });
    if (!item) return interaction.editReply({ content: `لم يتم العثور على منتج باسم **${itemName}**.` });
    if (item.quantity <= 0) return interaction.editReply({ content: `نفد مخزون المنتج **${itemName}**.` });

    item.quantity -= 1;
    item.soldCount += 1;
    await item.save();

    await Transaction.create({
      userId: targetUser.id,
      username: targetUser.username,
      type: 'item_given',
      itemName: item.name,
      itemPrice: 0,
      performedBy: interaction.user.id
    });

    // Send DM invoice
    const dmEmbed = invoiceEmbed('item_given', {
      itemName: item.name,
      givenBy: `<@${interaction.user.id}>`
    });

    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch {}

    // Log
    const logChannel = await interaction.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('إهداء منتج',
          `**المنتج:** ${itemName}\n**المستلم:** <@${targetUser.id}>\n**أُهدي بواسطة:** <@${interaction.user.id}>`
        )]
      });
    }

    await interaction.editReply({ content: `تم إهداء **${itemName}** للعضو <@${targetUser.id}> بنجاح.` });
  }
};
