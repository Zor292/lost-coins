const { User, Transaction } = require('../models');
const { logEmbed, baseEmbed } = require('../utils/embeds');

module.exports = {
  name: 'removecoins',
  aliases: ['remove-coins'],
  description: 'خصم كوينز من عضو | -removecoins [@مستخدم] [الكمية]',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!message.member.roles.cache.has(adminRoleId)) {
      return message.reply('ليس لديك صلاحية استخدام هذا الأمر.');
    }

    const target = message.mentions.users.first();
    if (!target) return message.reply('يرجى ذكر العضو. مثال: `-removecoins @user 10`');

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1) return message.reply('يرجى إدخال كمية صحيحة أكبر من 0.');

    let userData = await User.findOne({ userId: target.id });
    if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });

    if (userData.lostCoins < amount) {
      return message.reply(`رصيد العضو غير كافٍ. رصيده الحالي: **${userData.lostCoins} لوست كوين**`);
    }

    userData.lostCoins -= amount;
    await userData.save();

    await Transaction.create({
      userId: target.id,
      username: target.username,
      type: 'coins_removed',
      coinsAmount: amount,
      performedBy: message.author.id
    });

    // DM العضو
    try {
      const dm = baseEmbed()
        .setTitle('خصم لوست كوين')
        .setDescription(
          `**تم خصم كوينز من حسابك**\n\n` +
          `**الكمية المخصومة:** ${amount} لوست كوين\n` +
          `**رصيدك الحالي:** ${userData.lostCoins} لوست كوين\n` +
          `**بواسطة:** <@${message.author.id}>\n` +
          `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
        );
      await target.send({ embeds: [dm] });
    } catch {}

    // Log
    const logChannel = await message.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('خصم كوينز يدوي',
          `**العضو:** <@${target.id}>\n**الكمية المخصومة:** ${amount} لوست كوين\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين\n**بواسطة:** <@${message.author.id}>`
        )]
      });
    }

    await message.reply(`تم خصم **${amount} لوست كوين** من <@${target.id}>. رصيده الحالي: **${userData.lostCoins} لوست كوين**`);
  }
};
