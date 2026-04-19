const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { logEmbed } = require('../utils/embeds');
const fs = require('fs');
const path = require('path');

const EMBED_COLOR = 0x000000;
const FOOTER_TEXT = 'Developed by firas';
const TAX_RATE = 0.057;
const COIN_OPTIONS = [1, 5, 10, 20, 30, 50];

function calcWithTax(pricePerCoin, coins) {
  const base = coins * pricePerCoin;
  const tax = Math.ceil(base * TAX_RATE);
  return { base, tax, total: base + tax };
}

function updateEnvPrice(newPrice) {
  const envPath = path.join(process.cwd(), '.env');
  try {
    let content = fs.readFileSync(envPath, 'utf8');
    if (content.includes('PRICE_PER_COIN=')) {
      content = content.replace(/PRICE_PER_COIN=.*/g, `PRICE_PER_COIN=${newPrice}`);
    } else {
      content += `\nPRICE_PER_COIN=${newPrice}`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  } catch {}
  process.env.PRICE_PER_COIN = String(newPrice);
}

function buildPriceTable(pricePerCoin) {
  return COIN_OPTIONS.map(c => {
    const p = calcWithTax(pricePerCoin, c);
    return (
      `**${c} كوين**\n` +
      `> السعر الأساسي: ${p.base.toLocaleString()} كردت\n` +
      `> الضريبة (5.7%): ${p.tax.toLocaleString()} كردت\n` +
      `> **الإجمالي: ${p.total.toLocaleString()} كردت**`
    );
  }).join('\n\n');
}

module.exports = {
  name: 'setprice',
  aliases: ['changeprice'],
  description: 'تعديل سعر الكوين الواحد',

  slashData: new SlashCommandBuilder()
    .setName('setprice')
    .setDescription('رفع أو تقليل سعر الكوين')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('تحديد سعر جديد للكوين')
        .addIntegerOption(o =>
          o.setName('سعر').setDescription('السعر الجديد لكوين واحد بالكردت').setMinValue(100).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('raise')
        .setDescription('رفع السعر بنسبة مئوية')
        .addNumberOption(o =>
          o.setName('نسبة').setDescription('نسبة الرفع % (مثال: 10 = رفع 10%)').setMinValue(0.1).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('lower')
        .setDescription('تقليل السعر بنسبة مئوية')
        .addNumberOption(o =>
          o.setName('نسبة').setDescription('نسبة التقليل % (مثال: 10 = تقليل 10%)').setMinValue(0.1).setMaxValue(90).setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('عرض الأسعار الحالية مع الضريبة')
    )
    .toJSON(),

  async execute(message, args, client) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

    const sub = args[0]?.toLowerCase();
    const currentPrice = parseFloat(process.env.PRICE_PER_COIN || '10527');

    if (sub === 'list' || !sub) {
      const embed = buildListEmbed(currentPrice);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'set') {
      const newPrice = parseInt(args[1]);
      if (isNaN(newPrice) || newPrice < 100) return message.reply('يرجى إدخال سعر صحيح (100 كردت على الأقل).');
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, 'تم تحديد السعر الجديد');
      await logChange(message.guild, message.author, currentPrice, newPrice);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'raise') {
      const pct = parseFloat(args[1]);
      if (isNaN(pct) || pct <= 0) return message.reply('يرجى إدخال نسبة صحيحة.');
      const newPrice = Math.ceil(currentPrice * (1 + pct / 100));
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, `تم رفع السعر بنسبة ${pct}%`);
      await logChange(message.guild, message.author, currentPrice, newPrice);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'lower') {
      const pct = parseFloat(args[1]);
      if (isNaN(pct) || pct <= 0 || pct >= 100) return message.reply('يرجى إدخال نسبة صحيحة (بين 0.1 و 90).');
      const newPrice = Math.ceil(currentPrice * (1 - pct / 100));
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, `تم تقليل السعر بنسبة ${pct}%`);
      await logChange(message.guild, message.author, currentPrice, newPrice);
      return message.reply({ embeds: [embed] });
    }

    return message.reply('الاستخدام: `-setprice set [سعر]` أو `-setprice raise [نسبة%]` أو `-setprice lower [نسبة%]` أو `-setprice list`');
  },

  async executeSlash(interaction, client) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const currentPrice = parseFloat(process.env.PRICE_PER_COIN || '10527');

    if (sub === 'list') {
      const embed = buildListEmbed(currentPrice);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'set') {
      const newPrice = interaction.options.getInteger('سعر');
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, 'تم تحديد السعر الجديد');
      await logChange(interaction.guild, interaction.user, currentPrice, newPrice);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'raise') {
      const pct = interaction.options.getNumber('نسبة');
      const newPrice = Math.ceil(currentPrice * (1 + pct / 100));
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, `تم رفع السعر بنسبة ${pct}%`);
      await logChange(interaction.guild, interaction.user, currentPrice, newPrice);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'lower') {
      const pct = interaction.options.getNumber('نسبة');
      const newPrice = Math.ceil(currentPrice * (1 - pct / 100));
      updateEnvPrice(newPrice);
      const embed = buildChangeEmbed(currentPrice, newPrice, `تم تقليل السعر بنسبة ${pct}%`);
      await logChange(interaction.guild, interaction.user, currentPrice, newPrice);
      return interaction.reply({ embeds: [embed] });
    }
  }
};

function buildListEmbed(pricePerCoin) {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('قائمة الأسعار الحالية')
    .setDescription(
      `**سعر الكوين الواحد:** ${pricePerCoin.toLocaleString()} كردت\n` +
      `**الضريبة:** 5.7%\n\n` +
      buildPriceTable(pricePerCoin)
    )
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

function buildChangeEmbed(oldPrice, newPrice, title) {
  const diff = newPrice - oldPrice;
  const diffPct = ((diff / oldPrice) * 100).toFixed(1);
  const arrow = diff >= 0 ? '📈' : '📉';

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${arrow} ${title}`)
    .setDescription(
      `**السعر القديم:** ${oldPrice.toLocaleString()} كردت\n` +
      `**السعر الجديد:** ${newPrice.toLocaleString()} كردت\n` +
      `**الفرق:** ${diff >= 0 ? '+' : ''}${diff.toLocaleString()} كردت (${diff >= 0 ? '+' : ''}${diffPct}%)\n\n` +
      `**الأسعار الجديدة (شامل الضريبة 5.7%):**\n\n` +
      buildPriceTable(newPrice)
    )
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

async function logChange(guild, author, oldPrice, newPrice) {
  try {
    const logChannel = await guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('تعديل سعر الكوين',
          `**السعر القديم:** ${oldPrice.toLocaleString()} كردت\n**السعر الجديد:** ${newPrice.toLocaleString()} كردت\n**بواسطة:** <@${author.id}>`
        )]
      });
    }
  } catch {}
}
