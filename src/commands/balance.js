const { SlashCommandBuilder } = require('discord.js');
const { User } = require('../models');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('عرض رصيدك من اللوست كوين')
    .addUserOption(opt =>
      opt.setName('user').setDescription('عضو معين (للمشرفين فقط)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetOption = interaction.options.getUser('user');
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isAdmin = interaction.member.roles.cache.has(adminRoleId);

    let target = interaction.user;
    if (targetOption) {
      if (!isAdmin) return interaction.editReply({ content: 'ليس لديك صلاحية عرض رصيد الآخرين.' });
      target = targetOption;
    }

    let userData = await User.findOne({ userId: target.id });
    if (!userData) userData = await User.create({ userId: target.id, username: target.username, lostCoins: 0 });

    const embed = baseEmbed()
      .setTitle('رصيد اللوست كوين')
      .setDescription(`**العضو:** <@${target.id}>\n**الرصيد:** \`${userData.lostCoins} لوست كوين\``);

    await interaction.editReply({ embeds: [embed] });
  }
};
