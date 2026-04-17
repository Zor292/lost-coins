const { Item } = require('../models');
const { logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'add-item',
  aliases: ['additem'],
  description: 'إضافة منتج جديد | -add-item [الاسم] [السعر] [الكمية]',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!message.member.roles.cache.has(adminRoleId)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

    // -add-item <name> <price> <quantity>
    // Name can have spaces — last two args are price and quantity
    if (args.length < 3) {
      return message.reply('الاستخدام الصحيح: `-add-item [اسم المنتج] [السعر] [الكمية]`\nمثال: `-add-item VIP Role 50 5`');
    }

    const quantity = parseInt(args[args.length - 1]);
    const price = parseInt(args[args.length - 2]);
    const name = args.slice(0, args.length - 2).join(' ');

    if (!name || isNaN(price) || isNaN(quantity) || price < 1 || quantity < 1) {
      return message.reply('تأكد من إدخال اسم صحيح، سعر وكمية أكبر من 0.');
    }

    const existing = await Item.findOne({ name });
    if (existing) {
      return message.reply(`منتج باسم **${name}** موجود بالفعل. استخدم \`-add-quantity\` لزيادة الكمية.`);
    }

    await Item.create({ name, price, quantity, addedBy: message.author.id });

    const logChannel = await message.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('إضافة منتج',
          `**المنتج:** ${name}\n**السعر:** ${price} لوست كوين\n**الكمية:** ${quantity}\n**أضيف بواسطة:** <@${message.author.id}>`
        )]
      });
    }

    await message.reply(`تم إضافة المنتج **${name}** بسعر **${price} لوست كوين** وكمية **${quantity}** بنجاح.`);
  }
};
