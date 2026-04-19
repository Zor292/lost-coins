const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { User, Item, Transaction, ShopPanel, PendingPurchase } = require('../models');
const { shopPanelEmbed, ticketOpenEmbed, productListEmbed, invoiceEmbed, logEmbed } = require('../utils/embeds');

const FOOTER_TEXT = 'Developed by firas';
const EMBED_COLOR = 0x000000;

async function refreshPanel(guild) {
  const panel = await ShopPanel.findOne({ guildId: guild.id });
  if (!panel) return;
  const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!ch) return;
  const msg = await ch.messages.fetch(panel.messageId).catch(() => null);
  if (!msg) return;
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('shop_panel_menu')
      .setPlaceholder('اختر خيارًا...')
      .addOptions([
        { label: 'فتح تكت شراء', description: 'فتح تكت شراء جديد', value: 'open_ticket', emoji: { name: '🛒' } },
        { label: 'ريسيت القائمة', description: 'تحديث لوحة المتجر', value: 'reset_panel', emoji: { name: '🔄' } }
      ])
  );
  await msg.edit({ embeds: [shopPanelEmbed()], components: [row] });
}

async function openTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
  if (existingChannel) {
    return interaction.reply({ content: `لديك تكت مفتوح بالفعل: <#${existingChannel.id}>`, ephemeral: true });
  }
  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.id}`,
    type: ChannelType.GuildText,
    parent: process.env.SHOP_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: process.env.ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
    ]
  });
  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('اغلاق التكت').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('show_products').setLabel('اظهار المنتجات').setStyle(ButtonStyle.Primary)
  );
  await ticketChannel.send({
    content: `<@${user.id}>`,
    embeds: [ticketOpenEmbed(`<@${user.id}>`)],
    components: [closeRow]
  });
  await interaction.reply({ content: `تم فتح تكتك: <#${ticketChannel.id}>`, ephemeral: true });
}

async function buildProductsMenu() {
  const items = await Item.find({});
  if (!items.length) return null;
  const options = items.map(item => ({
    label: item.name,
    description: `${item.price} لوست كوين — ${item.quantity <= 0 ? 'نفد المخزون' : `متبقي: ${item.quantity}`}`,
    value: `buy_${item.name}`,
    ...(item.quantity <= 0 ? { emoji: { name: '🔴' } } : { emoji: { name: '🟢' } })
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('buy_product_menu')
      .setPlaceholder('اختر منتجًا للشراء...')
      .addOptions(options)
  );
}

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('buycoins_select_')) {
        const ownerId = interaction.customId.replace('buycoins_select_', '');
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: 'هذه القائمة ليست لك.', ephemeral: true });
        }
        await interaction.deferUpdate();
        const coinsRequested = parseInt(interaction.values[0]);
        const PRICE_PER_COIN = parseFloat(process.env.PRICE_PER_COIN || '10527');
        const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.057');
        const basePrice = coinsRequested * PRICE_PER_COIN;
        const tax = Math.ceil(basePrice * TAX_RATE);
        const creditsRequired = basePrice + tax;

        await PendingPurchase.deleteOne({ userId: interaction.user.id }).catch(() => null);
        const expiresAt = new Date(Date.now() + 60 * 1000);
        const pending = await PendingPurchase.create({
          userId: interaction.user.id,
          username: interaction.user.username,
          coinsRequested,
          creditsRequired,
          channelId: interaction.channel.id,
          expiresAt
        });
        const expireTimestamp = Math.floor(expiresAt.getTime() / 1000);
        const embed = new EmbedBuilder()
          .setColor(EMBED_COLOR)
          .setTitle('تأكيد طلب الشراء')
          .setDescription(
            `**الكمية:** ${coinsRequested} لوست كوين\n` +
            `**السعر الأساسي:** ${basePrice.toLocaleString()} كردت\n` +
            `**الضريبة (5.7%):** ${tax.toLocaleString()} كردت\n` +
            `**الإجمالي:** ${creditsRequired.toLocaleString()} كردت\n\n` +
            `**قم بالتحويل عبر ProBot:**\n` +
            `\`\`\`\nc ${process.env.PROBOT_ACCOUNT_ID} ${creditsRequired}\n\`\`\`\n` +
            `> ينتهي الطلب: <t:${expireTimestamp}:R>\n\n` +
            `بعد التحويل سيتم إضافة الكوينز تلقائيًا لحسابك.`
          )
          .setFooter({ text: FOOTER_TEXT });

        const pendingId = pending._id;
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;

        setTimeout(async () => {
          try {
            const p = await PendingPurchase.findOne({ _id: pendingId });
            if (p) {
              await PendingPurchase.deleteOne({ _id: pendingId });
              const ch = await client.channels.fetch(channelId).catch(() => null);
              if (ch) {
                await ch.send({
                  content: `<@${userId}> انتهى وقت طلب شراء **${coinsRequested} لوست كوين**. استخدم \`-buycoins\` مجدداً.`
                }).catch(() => null);
              }
            }
          } catch {}
        }, 60 * 1000);

        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      if (interaction.customId === 'shop_panel_menu') {
        const value = interaction.values[0];
        if (value === 'open_ticket') {
          await openTicket(interaction);
        } else if (value === 'reset_panel') {
          await refreshPanel(interaction.guild);
          await interaction.reply({ content: 'تم تحديث لوحة المتجر.', ephemeral: true });
        }
        return;
      }

      if (interaction.customId === 'buy_product_menu') {
        await interaction.deferReply({ ephemeral: true });
        const itemName = interaction.values[0].replace('buy_', '');
        const item = await Item.findOne({ name: itemName });
        if (!item || item.quantity <= 0) {
          return interaction.editReply({ content: `عذرًا، نفد مخزون **${itemName}**.` });
        }
        let userData = await User.findOne({ userId: interaction.user.id });
        if (!userData) userData = await User.create({ userId: interaction.user.id, username: interaction.user.username, lostCoins: 0 });
        if (userData.lostCoins < item.price) {
          return interaction.editReply({
            content: `رصيدك غير كافٍ. تحتاج **${item.price} لوست كوين** ورصيدك **${userData.lostCoins} لوست كوين**.`
          });
        }
        userData.lostCoins -= item.price;
        await userData.save();
        item.quantity -= 1;
        item.soldCount += 1;
        await item.save();
        await Transaction.create({
          userId: interaction.user.id,
          username: interaction.user.username,
          type: 'item_purchase',
          itemName: item.name,
          itemPrice: item.price
        });
        try {
          await interaction.user.send({
            embeds: [invoiceEmbed('item_purchase', { itemName: item.name, price: item.price, remaining: userData.lostCoins })]
          });
        } catch {}
        const logChannel = await interaction.guild.channels.fetch(process.env.SHOP_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          await logChannel.send({
            embeds: [logEmbed('شراء منتج',
              `**المشتري:** <@${interaction.user.id}>\n**المنتج:** ${item.name}\n**السعر:** ${item.price} لوست كوين\n**الرصيد المتبقي:** ${userData.lostCoins} لوست كوين`
            )]
          });
        }
        await interaction.editReply({ content: `تمت عملية شراء **${item.name}** بنجاح! رصيدك الحالي: **${userData.lostCoins} لوست كوين**` });
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'close_ticket') {
        const isAdmin = interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
        const isOwner = interaction.channel.name === `ticket-${interaction.user.id}`;
        if (!isAdmin && !isOwner) {
          return interaction.reply({ content: 'ليس لديك صلاحية اغلاق هذا التكت.', ephemeral: true });
        }
        await interaction.reply({ content: 'سيتم اغلاق التكت خلال 5 ثواني...' });
        setTimeout(async () => { await interaction.channel.delete().catch(() => null); }, 5000);
        return;
      }
      if (interaction.customId === 'show_products') {
        await interaction.deferReply({ ephemeral: false });
        const items = await Item.find({});
        const productsMenu = await buildProductsMenu();
        if (!productsMenu) return interaction.editReply({ content: 'لا توجد منتجات متاحة حاليًا.' });
        await interaction.editReply({ embeds: [productListEmbed(items)], components: [productsMenu] });
        return;
      }
    }
  }
};
