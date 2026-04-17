const { SlashCommandBuilder } = require('discord.js');
const { buyCoinEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy-coins')
    .setDescription('عرض طريقة شراء لوست كوين'),

  async execute(interaction) {
    const embed = buyCoinEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
