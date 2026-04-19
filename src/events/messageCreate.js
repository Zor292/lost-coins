const { User, Transaction, PendingPurchase } = require('../models');
const { invoiceEmbed, logEmbed, baseEmbed } = require('../utils/embeds');

const PROBOT_ID = '282859044593598464';

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.id !== PROBOT_ID) return;

    const shopWalletId = process.env.PROBOT_ACCOUNT_ID;
    if (!shopWalletId) return;

    const content = message.content || '';
    console.log(`[ProBot Message] ${JSON.stringify(content)}`);

    const hasWalletMention = content.includes(shopWalletId);

    let embedContent = '';
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        embedContent += (embed.description || '') + ' ' + (embed.title || '') + ' ';
        if (embed.fields) embed.fields.forEach(f => { embedContent += f.value + ' '; });
      }
    }

    const fullContent = content + ' ' + embedContent;

    let creditsTransferred = null;
    const patterns = [
      /`\$([0-9,]+)`/,
      /\$([0-9,]+)/,
      /([0-9,]{4,})\$/,
      /([0-9]{4,})/,
    ];

    for (const pattern of patterns) {
      const match = fullContent.match(pattern);
      if (match) {
        const val = parseInt(match[1].replace(/,/g, ''), 10);
        if (val >= 1000) {
          creditsTransferred = val;
          break;
        }
      }
    }

    if (!creditsTransferred) return;

    const now = new Date();
    const allPending = await PendingPurchase.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });

    if (!allPending.length) return;

    let matchedPending = null;
    for (const p of allPending) {
      if (creditsTransferred >= p.creditsRequired) {
        matchedPending = p;
        break;
      }
    }

    if (!matchedPending) {
      const closest = allPending[0];
      try {
        const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
        const ch = buyChannel || message.channel;
        await ch.send({
          content: `<@${closest.userId}> المبلغ الذي حولته (**${creditsTransferred.toLocaleString()} كردت**) أقل من المطلوب (**${closest.creditsRequired.toLocaleString()} كردت**). لم يتم إضافة الكوينز.`
        });
      } catch {}
      return;
    }

    const senderId = matchedPending.userId;
    const coinsToAdd = matchedPending.coinsRequested;

    await PendingPurchase.deleteOne({ _id: matchedPending._id });

    let userData = await User.findOne({ userId: senderId });
    if (!userData) {
      userData = await User.create({ userId: senderId, username: matchedPending.username, lostCoins: 0 });
    }
    userData.lostCoins += coinsToAdd;
    await userData.save();

    await Transaction.create({
      userId: senderId,
      username: matchedPending.username,
      type: 'coin_purchase',
      coinsAmount: coinsToAdd,
      creditsAmount: creditsTransferred
    });

    try {
      const member = await message.guild?.members.fetch(senderId).catch(() => null);
      if (member) {
        const dmEmbed = baseEmbed()
          .setTitle('تم إضافة لوست كوين')
          .setDescription(
            `تم إضافة **${coinsToAdd} لوست كوين** إلى حسابك بنجاح\n\n` +
            `**الكردت المدفوع:** ${creditsTransferred.toLocaleString()} كردت\n` +
            `**رصيدك الحالي:** ${userData.lostCoins} لوست كوين\n` +
            `**التاريخ:** <t:${Math.floor(Date.now() / 1000)}:F>`
          );
        await member.send({ embeds: [dmEmbed] });
      }
    } catch {}

    try {
      const logChannel = await message.guild?.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({
          embeds: [logEmbed('شراء لوست كوين',
            `**العضو:** <@${senderId}>\n**الكوينز المضافة:** ${coinsToAdd} لوست كوين\n**الكردت المدفوع:** ${creditsTransferred.toLocaleString()} كردت\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين`
          )]
        });
      }
    } catch {}

    try {
      const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
      const ch = buyChannel || message.channel;
      await ch.send({
        content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** إلى حسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين** 🎉`
      });
    } catch {}
  }
};
