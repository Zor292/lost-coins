const { ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');
const { shopPanelEmbed } = require('../utils/embeds');
const { ShopPanel } = require('../models');

module.exports = {
  name: 'shoppanel',
  description: 'يرسل لوحة المتجر الرئيسية',

  slashData: new SlashCommandBuilder()
    .setName('shoppanel')
    .setDescription('إرسال لوحة المتجر الرئيسية')
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }
    await sendPanel(message.guild, message.channel);
    await message.delete().catch(() => null);
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    await sendPanel(interaction.guild, interaction.channel);
    await interaction.editReply({ content: 'تم إرسال لوحة المتجر.' });
  }
};

async function sendPanel(guild, channel) {
  try {
    const oldPanel = await ShopPanel.findOne({ guildId: guild.id });
    if (oldPanel) {
      const oldChannel = await guild.channels.fetch(oldPanel.channelId).catch(() => null);
      if (oldChannel) {
        const oldMsg = await oldChannel.messages.fetch(oldPanel.messageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => null);
      }
      await ShopPanel.deleteOne({ guildId: guild.id });
    }
  } catch {}

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('shop_panel_menu')
      .setPlaceholder('اختر خيارًا...')
      .addOptions([
        { label: 'فتح تكت شراء', description: 'فتح تكت شراء جديد', value: 'open_ticket', emoji: { name: '🛒' } },
        { label: 'ريسيت القائمة', description: 'تحديث لوحة المتجر', value: 'reset_panel', emoji: { name: '🔄' } }
      ])
  );

  const msg = await channel.send({ embeds: [shopPanelEmbed()], components: [row] });
  await ShopPanel.create({ guildId: guild.id, channelId: channel.id, messageId: msg.id });
}
