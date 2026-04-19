const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { PendingPurchase } = require('../models');

const FOOTER_TEXT = 'Developed by firas';
const EMBED_COLOR = 0x000000;
const COIN_OPTIONS = [1, 5, 10, 20, 30, 50];

function calcPrice(coins) {
  const PRICE_PER_COIN = parseFloat(process.env.PRICE_PER_COIN || '10527');
  const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.057');
  const base = coins * PRICE_PER_COIN;
  const tax = Math.ceil(base * TAX_RATE);
  return { base, tax, total: base + tax };
}

module.exports = {
  name: 'buycoins',
  description: 'شراء لوست كوين',

  slashData: new SlashCommandBuilder()
    .setName('buycoins')
    .setDescription('شراء لوست كوين')
    .toJSON(),

  async execute(message, args, client) {
    const SHOP_CHANNEL_ID = process.env.BUY_COINS_CHANNEL_ID;
    if (SHOP_CHANNEL_ID && message.channel.id !== SHOP_CHANNEL_ID) {
      return message.reply(`يجب استخدام هذا الأمر في <#${SHOP_CHANNEL_ID}>.`);
    }
    await PendingPurchase.deleteOne({ userId: message.author.id }).catch(() => null);
    const { embed, row } = buildBuyEmbed(message.author.id);
    await message.reply({ embeds: [embed], components: [row] });
  },

  async executeSlash(interaction, client) {
    const SHOP_CHANNEL_ID = process.env.BUY_COINS_CHANNEL_ID;
    if (SHOP_CHANNEL_ID && interaction.channel.id !== SHOP_CHANNEL_ID) {
      return interaction.reply({ content: `يجب استخدام هذا الأمر في <#${SHOP_CHANNEL_ID}>.`, ephemeral: true });
    }
    await PendingPurchase.deleteOne({ userId: interaction.user.id }).catch(() => null);
    const { embed, row } = buildBuyEmbed(interaction.user.id);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};

function buildBuyEmbed(userId) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('شراء لوست كوين')
    .setDescription(
      'اختر عدد الكوينز من القائمة أدناه.\n\n' +
      'بعد الاختيار لديك **دقيقة واحدة** لإتمام التحويل عبر ProBot.\n\n' +
      '**جدول الأسعار (شامل الضريبة 5.7%):**\n' +
      COIN_OPTIONS.map(c => {
        const p = calcPrice(c);
        return `\`${c} كوين\` — **${p.total.toLocaleString()} كردت**`;
      }).join('\n')
    )
    .setFooter({ text: FOOTER_TEXT });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`buycoins_select_${userId}`)
      .setPlaceholder('اختر عدد الكوينز...')
      .addOptions(
        COIN_OPTIONS.map(c => {
          const p = calcPrice(c);
          return {
            label: `${c} لوست كوين`,
            description: `${p.total.toLocaleString()} كردت (شامل الضريبة)`,
            value: `${c}`
          };
        })
      )
  );

  return { embed, row };
}
