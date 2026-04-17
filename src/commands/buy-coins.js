const { buyCoinEmbed } = require('../utils/embeds');

module.exports = {
  name: 'buy-coins',
  aliases: ['buycoins', 'شراء'],
  description: 'عرض طريقة شراء لوست كوين',

  async execute(message, args, client) {
    await message.reply({ embeds: [buyCoinEmbed()] });
  }
};
