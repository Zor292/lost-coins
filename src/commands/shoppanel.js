const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { shopPanelEmbed } = require('../utils/embeds');
const { ShopPanel } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shoppanel')
    .setDescription('يرسل لوحة المتجر الرئيسية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = shopPanelEmbed();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop_panel_menu')
        .setPlaceholder('اختر خيارًا...')
        .addOptions([
          {
            label: 'فتح تكت شراء',
            description: 'فتح تكت شراء جديد',
            value: 'open_ticket',
            emoji: { name: '🛒' }
          },
          {
            label: 'ريسيت القائمة',
            description: 'تحديث لوحة المتجر',
            value: 'reset_panel',
            emoji: { name: '🔄' }
          }
        ])
    );

    // Delete old panel if exists
    try {
      const oldPanel = await ShopPanel.findOne({ guildId: interaction.guild.id });
      if (oldPanel) {
        const oldChannel = await interaction.guild.channels.fetch(oldPanel.channelId).catch(() => null);
        if (oldChannel) {
          const oldMsg = await oldChannel.messages.fetch(oldPanel.messageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => null);
        }
        await ShopPanel.deleteOne({ guildId: interaction.guild.id });
      }
    } catch {}

    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

    await ShopPanel.create({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: msg.id
    });

    await interaction.editReply({ content: 'تم إرسال لوحة المتجر بنجاح.' });
  }
};
