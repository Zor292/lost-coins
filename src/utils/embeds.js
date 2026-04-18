const { EmbedBuilder } = require('discord.js');

const FOOTER_TEXT = 'Developed by firas';
const EMBED_COLOR = 0x000000; // Black

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setFooter({ text: FOOTER_TEXT });
}

function shopPanelEmbed() {
  return baseEmbed()
    .setTitle('متجر لوست بيس')
    .setDescription(
      '**مرحبا بك في متجر لوست بيس**\n\n' +
      'اختر من القائمة أدناه ما تريد القيام به.\n\n' +
      '> **فتح تكت شراء** — ابدأ عملية الشراء مع أحد المشرفين\n' +
      '> **ريسيت القائمة** — تحديث هذه اللوحة'
    )
    .setTimestamp();
}

function ticketOpenEmbed(user) {
  return baseEmbed()
    .setTitle('تكت شراء جديد')
    .setDescription(
      `**مرحبا ${user}**\n\n` +
      'تم فتح تكتك بنجاح. سيتواصل معك أحد المشرفين قريبًا.\n\n' +
      'يمكنك الضغط على **اظهار المنتجات** لعرض قائمة المنتجات المتاحة.'
    )
    .setTimestamp();
}

function productListEmbed(items) {
  const embed = baseEmbed()
    .setTitle('قائمة المنتجات');

  if (!items || items.length === 0) {
    embed.setDescription('لا توجد منتجات متاحة حاليًا.');
    return embed;
  }

  const lines = items.map(item => {
    const stock = item.quantity <= 0
      ? '`نفد المخزون`'
      : `الكمية: \`${item.quantity}\``;
    return `**${item.name}**\nالسعر: \`${item.price} لوست كوين\` — ${stock}`;
  });

  embed.setDescription(lines.join('\n\n'));
  return embed;
}

function invoiceEmbed(type, data) {
  const embed = baseEmbed().setTitle('فاتورة');

  if (type === 'item_purchase') {
    embed.setDescription(
      `**نوع العملية:** شراء منتج\n` +
      `**المنتج:** ${data.itemName}\n` +
      `**السعر:** ${data.price} لوست كوين\n` +
      `**الرصيد المتبقي:** ${data.remaining} لوست كوين\n` +
      `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
    );
  } else if (type === 'item_given') {
    embed.setDescription(
      `**نوع العملية:** منتج مهدى\n` +
      `**المنتج:** ${data.itemName}\n` +
      `**من:** ${data.givenBy}\n` +
      `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
    );
  } else if (type === 'coin_purchase') {
    embed.setDescription(
      `**نوع العملية:** شراء لوست كوين\n` +
      `**الكمية:** ${data.coins} لوست كوين\n` +
      `**الكردت المدفوع:** ${data.credits.toLocaleString()} كردت\n` +
      `**رصيدك الحالي:** ${data.newBalance} لوست كوين\n` +
      `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
    );
  }

  return embed;
}

function buyCoinEmbed() {
  return baseEmbed()
    .setTitle('شراء لوست كوين')
    .setDescription(
      '**كيفية شراء لوست كوين:**\n\n' +
      '**سعر الصرف:**\n' +
      '`10,000 كردت = 1 لوست كوين`\n\n' +
      '**خطوات الشراء:**\n' +
      '**1.** حدد عدد اللوست كوين الذي تريده\n' +
      '**2.** احسب المبلغ: `عدد الكوين × 10,000 كردت`\n' +
      '**3.** قم بالتحويل عن طريق ProBot بالأمر التالي:\n\n' +
      '```\nc 598583098330054664 [المبلغ بالكردت]\n```\n' +
      '**مثال:** لشراء 5 لوست كوين:\n' +
      '```\nc 598583098330054664 50000\n```\n' +
      '**4.** سيتم إضافة الكوينز تلقائيًا لحسابك بعد اكتمال التحويل.\n\n' +
      '> التحويل يجب أن يكون لـ ID: `598583098330054664`'
    )
    .setTimestamp();
}

function logEmbed(type, data) {
  return baseEmbed()
    .setTitle(`سجل — ${type}`)
    .setDescription(data)
    .setTimestamp();
}

module.exports = {
  shopPanelEmbed,
  ticketOpenEmbed,
  productListEmbed,
  invoiceEmbed,
  buyCoinEmbed,
  logEmbed,
  baseEmbed
};
