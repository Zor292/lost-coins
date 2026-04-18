const { User, Transaction, PendingPurchase } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

const PROBOT_ID = '282859044593598464';
const PRICE_PER_COIN = 10527; // سعر الكوين الواحد بعد الضريبة

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.id !== PROBOT_ID) return;

    const shopWalletId = process.env.PROBOT_ACCOUNT_ID;
    if (!shopWalletId) return;

    // رسالة التحويل: **:moneybag: | username, has transferred `$AMOUNT` to <@!ID> **
    const transferRegex = /has transferred `\$([0-9,]+)` to <@!?(\d+)>/i;
    const content = message.content || '';
    const transferMatch = content.match(transferRegex);
    if (!transferMatch) return;

    const receiverId = transferMatch[2];
    if (receiverId !== shopWalletId) return;

    const creditsTransferred = parseInt(transferMatch[1].replace(/,/g, ''), 10);
    if (isNaN(creditsTransferred) || creditsTransferred <= 0) return;

    const now = new Date();

    // ابحث عن الطلب المعلق الأقرب للمبلغ المحوَّل (مدته لم تنتهِ)
    // نجيب كل الطلبات المعلقة ونختار الأنسب
    const allPending = await PendingPurchase.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });

    if (!allPending.length) {
      console.log(`[Transfer] No active pending purchases. Amount: ${creditsTransferred}`);
      return;
    }

    // نبحث عن طلب يكون المبلغ المحوَّل >= المبلغ المطلوب للطلب
    // نختار الطلب الذي مبلغه أقرب للمبلغ المحوَّل (ودون تجاوز كثير)
    let matchedPending = null;

    for (const p of allPending) {
      if (creditsTransferred >= p.creditsRequired) {
        // المبلغ المحوَّل يغطي هذا الطلب
        matchedPending = p;
        break;
      }
    }

    if (!matchedPending) {
      // المبلغ أقل من أي طلب معلق
      console.log(`[Transfer] Amount ${creditsTransferred} is less than all pending purchases`);

      // نبحث عن طلب قريب لنعلم صاحبه
      const closestPending = allPending[0];
      if (closestPending) {
        try {
          const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
          const targetChannel = buyChannel || message.channel;
          await targetChannel.send({
            content: `<@${closestPending.userId}> المبلغ الذي حولته (**${creditsTransferred.toLocaleString()} كردت**) أقل من المطلوب (**${closestPending.creditsRequired.toLocaleString()} كردت**). لم يتم إضافة الكوينز.`
          });
        } catch {}
      }
      return;
    }

    const senderId = matchedPending.userId;

    // احسب كم كوين يستحق بالمبلغ المحوَّل الفعلي
    // إذا دفع أكثر من المطلوب، نعطيه الكوينز المطلوبة في الطلب فقط (مش أكثر)
    // إذا دفع بالضبط أو أكثر قليلاً = يأخذ الكوينز المطلوبة
    const coinsToAdd = matchedPending.coinsRequested;

    // حذف الطلب المعلق
    await PendingPurchase.deleteOne({ _id: matchedPending._id });

    // إضافة الكوينز
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

    // DM الفاتورة
    try {
      const member = await message.guild?.members.fetch(senderId).catch(() => null);
      if (member) {
        await member.send({
          embeds: [invoiceEmbed('coin_purchase', {
            coins: coinsToAdd,
            credits: creditsTransferred,
            newBalance: userData.lostCoins
          })]
        });
      }
    } catch {}

    // سجل في قناة اللوق
    try {
      const logChannel = await message.guild?.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send({
          embeds: [logEmbed('شراء لوست كوين',
            `**العضو:** <@${senderId}>\n**الكوينز المضافة:** ${coinsToAdd} لوست كوين\n**الكردت المدفوع:** ${creditsTransferred.toLocaleString()} كردت\n**المطلوب كان:** ${matchedPending.creditsRequired.toLocaleString()} كردت\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين`
          )]
        });
      }
    } catch {}

    // إعلام في قناة شراء الكوين
    try {
      const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
      const targetChannel = buyChannel || message.channel;
      await targetChannel.send({
        content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** لحسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**`
      });
    } catch {}
  }
};
