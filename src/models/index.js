const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },
  lostCoins: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
userSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 0 },
  soldCount: { type: Number, default: 0 },
  addedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
itemSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String },
  type: {
    type: String,
    enum: ['coin_purchase', 'item_purchase', 'item_given', 'quantity_added', 'coins_added', 'coins_removed'],
    required: true
  },
  itemName: { type: String },
  itemPrice: { type: Number },
  coinsAmount: { type: Number },
  creditsAmount: { type: Number },
  performedBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const shopPanelSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const pendingPurchaseSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String },
  coinsRequested: { type: Number, required: true },
  creditsRequired: { type: Number, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const ShopPanel = mongoose.model('ShopPanel', shopPanelSchema);
const PendingPurchase = mongoose.model('PendingPurchase', pendingPurchaseSchema);

module.exports = { User, Item, Transaction, ShopPanel, PendingPurchase };
