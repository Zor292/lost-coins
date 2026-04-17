const { User, Transaction } = require('../models');
const { invoiceEmbed, logEmbed } = require('../utils/embeds');

// ProBot transfer message pattern:
// **:moneybag: | x1r7x, has transferred `$475000` to <@!869695228079112232> **
// We detect transfers TO the shop account (PROBOT_ACCOUNT_ID in .env is the RECEIVER)

const PROBOT_ID = '282859044593598464'; // Official ProBot Discord ID
const COINS_PER_CREDIT = 10000; // 10,000 credits = 1 Lost Coin

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    // Must be from ProBot
    if (message.author.id !== PROBOT_ID) return;

    // Check if this is a transfer message to our shop wallet
    const shopWalletId = process.env.PROBOT_ACCOUNT_ID; // 598583098330054664
    if (!shopWalletId) return;

    // Regex: detect transfer to our wallet
    // Matches: has transferred `$NUMBER` to <@!WALLET_ID>
    const transferRegex = /has transferred `\$([0-9,]+)` to <@!?(\d+)>/i;
    const senderRegex = /\|\s+(\S+),/; // the sender username part

    const content = message.content || '';
    const transferMatch = content.match(transferRegex);
    if (!transferMatch) return;

    const receiverId = transferMatch[2];
    if (receiverId !== shopWalletId) return;

    // Amount transferred (remove commas)
    const creditsTransferred = parseInt(transferMatch[1].replace(/,/g, ''), 10);
    if (isNaN(creditsTransferred) || creditsTransferred <= 0) return;

    // Calculate coins
    const coinsToAdd = Math.floor(creditsTransferred / COINS_PER_CREDIT);
    if (coinsToAdd <= 0) {
      // Too small — send a message in the channel
      await message.channel.send({
        content: `الحد الأدنى للتحويل هو **${COINS_PER_CREDIT.toLocaleString()} كردت** (= 1 لوست كوين). التحويل الخاص بك أقل من الحد المطلوب.`
      }).catch(() => null);
      return;
    }

    // Find who sent the transfer by searching guild members
    // ProBot mentions the sender's username in the message
    // We'll look for a member who sent this message in the guild
    // Best approach: search for a mention of sender in the message
    // ProBot format: **:moneybag: | USERNAME, has transferred...**
    const senderMatch = content.match(senderRegex);
    const senderUsername = senderMatch ? senderMatch[1].replace(/,/g, '') : null;

    let senderMember = null;
    if (senderUsername && message.guild) {
      // Try to find member by username
      const members = await message.guild.members.fetch({ query: senderUsername, limit: 5 }).catch(() => null);
      if (members) {
        senderMember = members.find(m =>
          m.user.username.toLowerCase() === senderUsername.toLowerCase() ||
          m.displayName.toLowerCase() === senderUsername.toLowerCase()
        );
      }
    }

    if (!senderMember) {
      // Can't find who transferred — log and skip
      console.warn(`[Transfer] Could not find sender for username: ${senderUsername}`);
      return;
    }

    const senderId = senderMember.user.id;

    // Add coins to user
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

    // Record transaction
    await Transaction.create({
      userId: senderId,
      username: senderMember.user.username,
      type: 'coin_purchase',
      coinsAmount: coinsToAdd,
      creditsAmount: creditsTransferred
    });

    // Send DM invoice
    const dm = invoiceEmbed('coin_purchase', {
      coins: coinsToAdd,
      credits: creditsTransferred,
      newBalance: userData.lostCoins
    });
    try {
      await senderMember.send({ embeds: [dm] });
    } catch {}

    // Log
    const logChannel = await message.guild?.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [logEmbed('شراء لوست كوين',
          `**العضو:** <@${senderId}>\n**الكوينز المضافة:** ${coinsToAdd} لوست كوين\n**الكردت المدفوع:** ${creditsTransferred.toLocaleString()} كردت\n**الرصيد الجديد:** ${userData.lostCoins} لوست كوين`
        )]
      });
    }

    // Confirm in channel
    await message.channel.send({
      content: `<@${senderId}> تم إضافة **${coinsToAdd} لوست كوين** لحسابك بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**`
    }).catch(() => null);
  }
};
