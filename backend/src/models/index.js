const sequelize = require("../config/database");
const createUser = require("./User");
const createCategory = require("./Category");
const createProduct = require("./Product");
const createCart = require("./Cart");
const createCartItem = require("./CartItem");
const createOrder = require("./Order");
const createOrderItem = require("./OrderItem");

const User = createUser(sequelize);
const Category = createCategory(sequelize);
const Product = createProduct(sequelize);
const Cart = createCart(sequelize);
const CartItem = createCartItem(sequelize);
const Order = createOrder(sequelize);
const OrderItem = createOrderItem(sequelize);

Category.hasMany(Product, { foreignKey: { allowNull: false } });
Product.belongsTo(Category);

User.hasOne(Cart);
Cart.belongsTo(User);

Cart.hasMany(CartItem, { onDelete: "CASCADE" });
CartItem.belongsTo(Cart);
Product.hasMany(CartItem);
CartItem.belongsTo(Product);

User.hasMany(Order);
Order.belongsTo(User);
Order.hasMany(OrderItem, { onDelete: "CASCADE" });
OrderItem.belongsTo(Order);
Product.hasMany(OrderItem);
OrderItem.belongsTo(Product);

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Cart,
  CartItem,
  Order,
  OrderItem,
};
