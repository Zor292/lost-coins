const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const { PendingPurchase } = require('../models');

const FOOTER_TEXT = 'Developed by firas';
const EMBED_COLOR = 0x000000;

// سعر كل كوين بالكردت بعد الضريبة (10527 لكل كوين)
const PRICE_PER_COIN = 10527;

const COIN_OPTIONS = [1, 5, 10, 20, 30, 50];

function calcPrice(coins) {
  return coins * PRICE_PER_COIN;
}

module.exports = {
  name: 'buy-coins',
  aliases: ['buycoins', 'شراء'],
  description: 'شراء لوست كوين',

  async execute(message, args, client) {
    const SHOP_CHANNEL_ID = process.env.BUY_COINS_CHANNEL_ID;

    // Check channel
    if (SHOP_CHANNEL_ID && message.channel.id !== SHOP_CHANNEL_ID) {
      return message.reply(`يجب استخدام هذا الأمر في <#${SHOP_CHANNEL_ID}>.`);
    }

    // Check if user already has a pending purchase
    const existing = await PendingPurchase.findOne({ userId: message.author.id });
    if (existing && existing.expiresAt > new Date()) {
      return message.reply(`لديك طلب شراء معلق بالفعل. أتمم التحويل أو انتظر انتهاء الوقت.`);
    }
    if (existing) await PendingPurchase.deleteOne({ userId: message.author.id });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('شراء لوست كوين')
      .setDescription(
        '**اختر عدد الكوينز من القائمة أدناه.**\n\n' +
        '> بعد الاختيار، لديك **دقيقتين فقط** لإتمام التحويل عبر ProBot.\n\n' +
        '**جدول الأسعار:**\n' +
        COIN_OPTIONS.map(c => `\`${c} كوين\` — **${calcPrice(c).toLocaleString()} كردت**`).join('\n')
      )
      .setFooter({ text: FOOTER_TEXT });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`buycoins_select_${message.author.id}`)
        .setPlaceholder('اختر عدد الكوينز...')
        .addOptions(
          COIN_OPTIONS.map(c => ({
            label: `${c} لوست كوين`,
            description: `${calcPrice(c).toLocaleString()} كردت`,
            value: `${c}`
          }))
        )
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
};
