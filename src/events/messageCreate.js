const { User, Transaction, PendingPurchase } = require('../models');
const { invoiceEmbed, logEmbed, baseEmbed } = require('../utils/embeds');

const PROBOT_ID = '282859044593598464';
const PRICE_PER_COIN = 10527; // سعر الكوين الواحد بعد الضريبة

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.id !== PROBOT_ID) return;

    const shopWalletId = process.env.PROBOT_ACCOUNT_ID;
    if (!shopWalletId) return;

    // رسالة التحويل من ProBot
    const transferRegex = /has transferred `\$([0-9,]+)` to <@!?(\d+)>/i;
    const content = message.content || '';
    const transferMatch = content.match(transferRegex);
    if (!transferMatch) return;

    const receiverId = transferMatch[2];
    if (receiverId !== shopWalletId) return;

    const creditsTransferred = parseInt(transferMatch[1].replace(/,/g, ''), 10);
    if (isNaN(creditsTransferred) || creditsTransferred <= 0) return;

    // ابحث عن المرسل عن طريق mention في الرسالة
    // ProBot format: **:moneybag: | USERNAME, has transferred `$X` to <@!ID> **
    // نحاول نجيب userId من المنشن الأول في الرسالة (المرسل)
    const mentionRegex = /<@!?(\d+)>/g;
    const allMentions = [...content.matchAll(mentionRegex)].map(m => m[1]);
    // أول mention هو المستلم (المحفظة)، وإذا كان فيه منشن للمرسل يكون الثاني
    // لكن ProBot لا يذكر ID المرسل بالعادة، يذكر اسمه فقط
    // نبحث عن pending purchase عن طريق قراءة كل الطلبات المعلقة

    // إيجاد الطلب المعلق الذي يطابق المبلغ المحول
    const now = new Date();
    const pending = await PendingPurchase.findOne({
      creditsRequired: creditsTransferred,
      expiresAt: { $gt: now }
    });

    if (!pending) {
      // لا يوجد طلب معلق بهذا المبلغ — ممكن تحويل خاطئ أو منتهي الصلاحية
      // نحاول نبحث بشكل تقريبي (±100 كردت للتسامح)
      const approxPending = await PendingPurchase.findOne({
        creditsRequired: { $gte: creditsTransferred - 100, $lte: creditsTransferred + 100 },
        expiresAt: { $gt: now }
      });

      if (!approxPending) {
        console.log(`[Transfer] No matching pending purchase for ${creditsTransferred} credits`);
        return;
      }

      await processPurchase(approxPending, creditsTransferred, message);
      return;
    }

    await processPurchase(pending, creditsTransferred, message);
  }
};

async function processPurchase(pending, creditsTransferred, message) {
  const { User, Transaction, PendingPurchase } = require('../models');
  const { invoiceEmbed, logEmbed } = require('../utils/embeds');

  const coinsToAdd = pending.coinsRequested;
  const senderId = pending.userId;

  // حذف الطلب المعلق
  await PendingPurchase.deleteOne({ _id: pending._id });

  // إضافة الكوينز
  let userData = await User.findOne({ userId: senderId });
  if (!userData) {
    userData = await User.create({ userId: senderId, username: pending.username, lostCoins: 0 });
  }

  userData.lostCoins += coinsToAdd;
  await userData.save();

  await Transaction.create({
    userId: senderId,
    username: pending.username,
    type: 'coin_purchase',
    coinsAmount: coinsToAdd,
    creditsAmount: creditsTransferred
  });

  // DM الفاتورة
  try {
    const guild = message.guild;
    const member = await guild?.members.fetch(senderId).catch(() => null);
    if (member) {
      const dm = invoiceEmbed('coin_purchase', {
        coins: coinsToAdd,
        credits: creditsTransferred,
        newBalance: userData.lostCoins
      });
      await member.send({ embeds: [dm] });
    }
  } catch {}

  // Log
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

  // رد في القناة
  try {
    const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
    const targetChannel = buyChannel || message.channel;
    await targetChannel.send({
      content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** لحسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**`
    });
  } catch {}
}
