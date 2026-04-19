const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const EMBED_COLOR = 0x000000;
const FOOTER_TEXT = 'Developed by firas';

module.exports = {
  name: 'help',
  aliases: [],
  description: 'عرض قائمة الأوامر',

  slashData: new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض قائمة الأوامر')
    .toJSON(),

  async execute(message, args, client) {
    const embed = buildHelpEmbed();
    await message.reply({ embeds: [embed] });
  },

  async executeSlash(interaction, client) {
    const embed = buildHelpEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('قائمة الأوامر')
    .setDescription(
      '**الأوامر المتاحة للجميع:**\n' +
      '`-buycoins` أو `/buycoins` — شراء لوست كوين\n\n' +
      '**أوامر الإدارة (تتطلب رتبة مشرف):**\n' +
      '`-addcoins @عضو [كمية]` — إضافة كوينز لعضو\n' +
      '`-removecoins @عضو [كمية]` — خصم كوينز من عضو\n' +
      '`-balance [@عضو]` — عرض الرصيد\n' +
      '`-additem [اسم] [سعر] [كمية]` — إضافة منتج\n' +
      '`-addquantity [اسم] [كمية]` — زيادة كمية منتج\n' +
      '`-giveitem @عضو [اسم]` — إهداء منتج\n' +
      '`-shoppanel` — إرسال لوحة المتجر\n' +
      '`-setprice [سعر جديد]` — تعديل سعر الكوين\n' +
      '`-pricelist` — عرض الأسعار الحالية مع الضريبة\n\n' +
      'جميع الأوامر تعمل بـ `-` أو `/`'
    )
    .setFooter({ text: FOOTER_TEXT });
}
