const { User, Transaction } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

const PROBOT_ID = '282859044593598464';
const COINS_PER_CREDIT = 10000;

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    // ProBot transfer detection only
    if (message.author.id !== PROBOT_ID) return;

    const shopWalletId = process.env.PROBOT_ACCOUNT_ID;
    if (!shopWalletId) return;

    const transferRegex = /has transferred `\$([0-9,]+)` to <@!?(\d+)>/i;
    const senderRegex = /\|\s+(\S+),/;

    const content = message.content || '';
    const transferMatch = content.match(transferRegex);
    if (!transferMatch) return;

    const receiverId = transferMatch[2];
    if (receiverId !== shopWalletId) return;

    const creditsTransferred = parseInt(transferMatch[1].replace(/,/g, ''), 10);
    if (isNaN(creditsTransferred) || creditsTransferred <= 0) return;

    const coinsToAdd = Math.floor(creditsTransferred / COINS_PER_CREDIT);
    if (coinsToAdd <= 0) {
      await message.channel.send({
        content: `الحد الأدنى للتحويل هو **${COINS_PER_CREDIT.toLocaleString()} كردت** (= 1 لوست كوين). التحويل الخاص بك أقل من الحد المطلوب.`
      }).catch(() => null);
      return;
    }

    const senderMatch = content.match(senderRegex);
    const senderUsername = senderMatch ? senderMatch[1].replace(/,/g, '') : null;

    let senderMember = null;
    if (senderUsername && message.guild) {
      const members = await message.guild.members.fetch({ query: senderUsername, limit: 5 }).catch(() => null);
      if (members) {
        senderMember = members.find(m =>
          m.user.username.toLowerCase() === senderUsername.toLowerCase() ||
          m.displayName.toLowerCase() === senderUsername.toLowerCase()
        );
      }
    }

    if (!senderMember) {
      console.warn(`[Transfer] Could not find sender for username: ${senderUsername}`);
      return;
    }

    const senderId = senderMember.user.id;

    let userData = await User.findOne({ userId: senderId });
    if (!userData) {
      userData = await User.create({
        userId: senderId,
        username: senderMember.user.username,
        lostCoins: 0
      });
    }

    userData.lostCoins += coinsToAdd;
    await userData.save();

    await Transaction.create({
      userId: senderId,
      username: senderMember.user.username,
      type: 'coin_purchase',
      coinsAmount: coinsToAdd,
      creditsAmount: creditsTransferred
    });

    const dm = invoiceEmbed('coin_purchase', {
      coins: coinsToAdd,
      credits: creditsTransferred,
      newBalance: userData.lostCoins
    });
    try { await senderMember.send({ embeds: [dm] }); } catch {}

    const logChannel = await message.guild?.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('شراء لوست كوين',
          `**العضو:** <@${senderId}>\n**الكوينز المضافة:** ${coinsToAdd} لوست كوين\n**الكردت المدفوع:** ${creditsTransferred.toLocaleString()} كردت\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين`
        )]
      });
    }

    await message.channel.send({
      content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** لحسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**`
    }).catch(() => null);
  }
};
