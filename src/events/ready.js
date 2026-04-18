module.exports = {
  name: 'ready',
  once: true,

  execute(client) {
    console.log(`[Lost Base] Bot is online as ${client.user.tag}`);
  }
};
