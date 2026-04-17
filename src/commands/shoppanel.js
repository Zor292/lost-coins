const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { shopPanelEmbed } = require('../utils/embeds');
const { ShopPanel } = require('../models');

module.exports = {
  name: 'shoppanel',
  description: 'يرسل لوحة المتجر الرئيسية',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!message.member.roles.cache.has(adminRoleId)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

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
      const oldPanel = await ShopPanel.findOne({ guildId: message.guild.id });
      if (oldPanel) {
        const oldChannel = await message.guild.channels.fetch(oldPanel.channelId).catch(() => null);
        if (oldChannel) {
          const oldMsg = await oldChannel.messages.fetch(oldPanel.messageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => null);
        }
        await ShopPanel.deleteOne({ guildId: message.guild.id });
      }
    } catch {}

    const msg = await message.channel.send({ embeds: [embed], components: [row] });

    await ShopPanel.create({
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: msg.id
    });

    // Delete the command message
    await message.delete().catch(() => null);
  }
};
