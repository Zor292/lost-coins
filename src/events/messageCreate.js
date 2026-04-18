const { User, Transaction, PendingPurchase } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

const PROBOT_ID = '282859044593598464';

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.id !== PROBOT_ID) return;

    const shopWalletId = process.env.PROBOT_ACCOUNT_ID;
    if (!shopWalletId) return;

    const content = message.content || '';

    // لوق كل رسائل ProBot للتشخيص
    console.log(`[ProBot Message] ${JSON.stringify(content)}`);

    // ── شرط أساسي: الرسالة لازم تحتوي على ID المحفظة أو اسمها ──
    // إذا ما كانت تحتوي على shopWalletId، نتحقق من embeds
    const hasWalletMention = content.includes(shopWalletId);
    
    // تحقق من embeds أيضاً (ProBot أحياناً يرسل التحويل في embed)
    let embedContent = '';
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        embedContent += (embed.description || '') + ' ' + (embed.title || '') + ' ';
        if (embed.fields) embed.fields.forEach(f => { embedContent += f.value + ' '; });
      }
      console.log(`[ProBot Embed] ${JSON.stringify(embedContent)}`);
    }

    const fullContent = content + ' ' + embedContent;

    // ── استخراج المبلغ ────────────────────────────────────────
    let creditsTransferred = null;

    // الأنماط الممكنة لرسالة ProBot:
    // إنجليزي: "has transferred `$10,527` to <@!ID>"
    // عربي 1:  "💰 | @username لـ 10000$ قام بتحويل - @wallet"
    // عربي 2:  "<@!ID> لـ `$10000`"
    // عربي 3:  "قام بتحويل 10000$ لـ @wallet"

    // نجرب كل الأنماط
    const patterns = [
      /`\$([0-9,]+)`/,           // `$10,527`
      /\$([0-9,]+)/,             // $10527 أو $10,527
      /([0-9,]{4,})\$/,          // 10000$ (المبلغ قبل $)
      /([0-9]{4,})/,             // أي رقم من 4 أرقام فأكثر
    ];

    for (const pattern of patterns) {
      const match = fullContent.match(pattern);
      if (match) {
        const val = parseInt(match[1].replace(/,/g, ''), 10);
        if (val >= 1000) { // أقل حد معقول للمبلغ
          creditsTransferred = val;
          break;
        }
      }
    }

    if (!creditsTransferred) {
      console.log(`[Transfer] Could not extract amount from ProBot message`);
      return;
    }

    console.log(`[Transfer] Extracted amount: ${creditsTransferred}`);

    // ── التحقق إن التحويل للمحفظة الصحيحة ────────────────────
    // نتحقق إذا كان ID المحفظة موجود في الرسالة
    // أو إذا ما كان موجود، نتحقق إن في طلب معلق نشط ونفترض إن التحويل صحيح
    const now = new Date();
    const allPending = await PendingPurchase.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });

    if (!allPending.length) {
      console.log(`[Transfer] No active pending purchases`);
      return;
    }

    // إذا كان ID المحفظة موجود في الرسالة = تحويل مؤكد للمحفظة
    // إذا ما كان موجود = نتحقق إن المبلغ يطابق طلب معلق (احتياط)
    if (!hasWalletMention && !embedContent.includes(shopWalletId)) {
      // المحفظة غير مذكورة، لكن ممكن ProBot يذكر اسم المستخدم بدل ID
      // نكمل ونطابق بالمبلغ فقط
      console.log(`[Transfer] Wallet ID not found in message, matching by amount only`);
    }

    // ابحث عن طلب يغطيه المبلغ المحوَّل
    let matchedPending = null;
    for (const p of allPending) {
      if (creditsTransferred >= p.creditsRequired) {
        matchedPending = p;
        break;
      }
    }

    if (!matchedPending) {
      const closest = allPending[0];
      console.log(`[Transfer] Amount ${creditsTransferred} < required ${closest.creditsRequired}`);
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

    console.log(`[Transfer] Match found! User: ${senderId}, Coins: ${coinsToAdd}`);

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

    // DM فاتورة
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

    // لوق
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

    // إعلام في قناة الشراء
    try {
      const buyChannel = await message.guild?.channels.fetch(process.env.BUY_COINS_CHANNEL_ID).catch(() => null);
      const ch = buyChannel || message.channel;
      await ch.send({
        content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** لحسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**`
      });
    } catch {}
  }
};
