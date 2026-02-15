const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/armax', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB Error:', err));

// ==================== MODELS (نماذج البيانات) ====================

// نموذج المنتجات
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  categoryName: String,
  price: { type: Number, required: true },
  oldPrice: Number,
  image: { type: String, required: true },
  description: String,
  badge: { type: String, default: '' },
  badgeText: { type: String, default: '' },
  stock: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// نموذج المستخدمين
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor'], default: 'editor' },
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// نموذج العروض
const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  discount: Number,
  icon: String,
  color: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// نموذج الطلبات (السلة)
const OrderSchema = new mongoose.Schema({
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  items: [{
    productId: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  total: Number,
  status: { type: String, default: 'pending' }, // pending, confirmed, delivered, cancelled
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);
const User = mongoose.model('User', UserSchema);
const Offer = mongoose.model('Offer', OfferSchema);
const Order = mongoose.model('Order', OrderSchema);

// ==================== MIDDLEWARE (التحقق) ====================

// التحقق من التوكن (JWT)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'armax_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// التحقق من الأدمن
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ==================== API ROUTES (الروابط) ====================

// --- المنتجات (Products) ---

// جلب جميع المنتجات (للموقع العام)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { isActive: true };
    
    if (category && category !== 'all') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب منتج واحد
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// إضافة منتج (يتطلب تسجيل دخول)
app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// تعديل منتج
app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// حذف منتج
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// --- المستخدمين (Users) ---

// تسجيل دخول
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // في الواقع يجب البحث في قاعدة البيانات
    // هذا مثال مبسط، يمكنك تطويره
    if (username === 'admin' && password === '123456') {
      const token = jwt.sign(
        { userId: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'armax_secret_key',
        { expiresIn: '24h' }
      );
      
      res.json({
        success: true,
        token,
        user: { name: 'المسؤول', role: 'admin' }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب المستخدمين
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- الطلبات (Orders) ---

// إنشاء طلب جديد (من السلة)
app.post('/api/orders', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// جلب جميع الطلبات (للأدمن)
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- العروض (Offers) ---

app.get('/api/offers', async (req, res) => {
  try {
    const offers = await Offer.find({ isActive: true });
    res.json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/offers', authMiddleware, async (req, res) => {
  try {
    const offer = new Offer(req.body);
    await offer.save();
    res.status(201).json({ success: true, data: offer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== تشغيل الخادم ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});