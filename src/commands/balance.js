const { User } = require('../models');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'coins'],
  description: 'عرض رصيد اللوست كوين | -balance [@مستخدم]',

  async execute(message, args, client) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isAdmin = message.member.roles.cache.has(adminRoleId);

    let target = message.author;
    const mentioned = message.mentions.users.first();

    if (mentioned) {
      if (!isAdmin) return message.reply('ليس لديك صلاحية عرض رصيد الآخرين.');
      target = mentioned;
    }

    let userData = await User.findOne({ userId: target.id });
    if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });

    const embed = baseEmbed()
      .setTitle('رصيد اللوست كوين')
      .setDescription(`**العضو:** <@${target.id}>\n**الرصيد:** \`${userData.lostCoins} لوست كوين\``);

    await message.reply({ embeds: [embed] });
  }
};
