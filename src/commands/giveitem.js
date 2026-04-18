const { Item, Transaction } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

module.exports = {
  name: 'giveitem',
  description: 'إهداء منتج لعضو | -giveitem [@المستخدم] [اسم المنتج]',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!message.member.roles.cache.has(adminRoleId)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

    if (args.length < 2) {
      return message.reply('الاستخدام الصحيح: `-giveitem [@المستخدم] [اسم المنتج]`\nمثال: `-giveitem @user VIP Role`');
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) return message.reply('يرجى ذكر العضو المراد إهداؤه.');

    const name = args.slice(1).join(' ');
    if (!name) return message.reply('يرجى ذكر اسم المنتج.');

    const item = await Item.findOne({ name });
    if (!item) return message.reply(`لم يتم العثور على منتج باسم **${name}**.`);
    if (item.quantity <= 0) return message.reply(`نفد مخزون المنتج **${name}**.`);

    item.quantity -= 1;
    item.soldCount += 1;
    await item.save();

    await Transaction.create({
      userId: targetUser.id,
      username: targetUser.username,
      type: 'item_given',
      itemName: item.name,
      itemPrice: 0,
      performedBy: message.author.id
    });

    try {
      await targetUser.send({
        embeds: [invoiceEmbed('item_given', { itemName: item.name, givenBy: `<@${message.author.id}>` })]
      });
    } catch {}

    const logChannel = await message.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('إهداء منتج',
          `**المنتج:** ${name}\n**المستلم:** <@${targetUser.id}>\n**أُهدي بواسطة:** <@${message.author.id}>`
        )]
      });
    }

    await message.reply(`تم إهداء **${name}** للعضو <@${targetUser.id}> بنجاح.`);
  }
};
