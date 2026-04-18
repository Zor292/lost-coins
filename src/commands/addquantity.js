const { Item } = require('../models');
const { logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'addquantity',
  description: 'زيادة كمية منتج | -addquantity [اسم المنتج] [الكمية]',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!message.member.roles.cache.has(adminRoleId)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

    if (args.length < 2) {
      return message.reply('الاستخدام الصحيح: `-addquantity [اسم المنتج] [الكمية]`\nمثال: `-addquantity VIP Role 3`');
    }

    const quantity = parseInt(args[args.length - 1]);
    const name = args.slice(0, args.length - 1).join(' ');

    if (!name || isNaN(quantity) || quantity < 1) {
      return message.reply('تأكد من إدخال اسم صحيح وكمية أكبر من 0.');
    }

    const item = await Item.findOne({ name });
    if (!item) return message.reply(`لم يتم العثور على منتج باسم **${name}**.`);

    item.quantity += quantity;
    await item.save();

    const logChannel = await message.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('إضافة كمية',
          `**المنتج:** ${name}\n**الكمية المضافة:** ${quantity}\n**الكمية الحالية:** ${item.quantity}\n**بواسطة:** <@${message.author.id}>`
        )]
      });
    }

    await message.reply(`تم إضافة **${quantity}** للمنتج **${name}**. الكمية الحالية: **${item.quantity}**`);
  }
};
