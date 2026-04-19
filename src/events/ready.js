module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Lost Base] Online as ${client.user.tag}`);
  }
};
