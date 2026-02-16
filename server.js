const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ==================== DATABASE CONNECTIONS (اتصالات قواعد البيانات) ====================

// MongoDB Connection (موجود)
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/armax", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// MySQL Connection Pool (جديد - لنظام عروض الأسعار)
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "armax_test",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// اختبار الاتصال بـ MySQL
mysqlPool
  .getConnection()
  .then((conn) => {
    console.log("✅ Connected to MySQL (armax_test)");
    conn.release();
  })
  .catch((err) => console.error("❌ MySQL Error:", err.message));

// ==================== MODELS (نماذج البيانات - MongoDB) ====================

// نموذج المنتجات
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  categoryName: String,
  price: { type: Number, required: true },
  oldPrice: Number,
  image: { type: String, required: true },
  description: String,
  badge: { type: String, default: "" },
  badgeText: { type: String, default: "" },
  stock: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// نموذج المستخدمين
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "editor"], default: "editor" },
  status: { type: String, default: "active" },
  createdAt: { type: Date, default: Date.now },
});

// نموذج العروض
const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  discount: Number,
  icon: String,
  color: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// نموذج الطلبات (السلة)
const OrderSchema = new mongoose.Schema({
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number,
      image: String,
    },
  ],
  total: Number,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", ProductSchema);
const User = mongoose.model("User", UserSchema);
const Offer = mongoose.model("Offer", OfferSchema);
const Order = mongoose.model("Order", OrderSchema);

// ==================== MIDDLEWARE (التحقق) ====================

// التحقق من التوكن (JWT)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "armax_secret_key",
    );
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// التحقق من الأدمن
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// ==================== API ROUTES (الروابط - MongoDB) ====================

// --- المنتجات (Products) ---
app.get("/api/products", async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { isActive: true };

    if (category && category !== "all") query.category = category;
    if (search) query.name = { $regex: search, $options: "i" };

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// --- المستخدمين (Users) ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === "admin" && password === "123456") {
      const token = jwt.sign(
        { userId: "admin", role: "admin" },
        process.env.JWT_SECRET || "armax_secret_key",
        { expiresIn: "24h" },
      );

      res.json({
        success: true,
        token,
        user: { name: "المسؤول", role: "admin" },
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- الطلبات (Orders) ---
app.post("/api/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- العروض (Offers) ---
app.get("/api/offers", async (req, res) => {
  try {
    const offers = await Offer.find({ isActive: true });
    res.json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/offers", authMiddleware, async (req, res) => {
  try {
    const offer = new Offer(req.body);
    await offer.save();
    res.status(201).json({ success: true, data: offer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== نظام عروض الأسعار (Quotes System - MySQL) ====================

// حفظ عرض سعر جديد
app.post("/api/quotes", async (req, res) => {
  const conn = await mysqlPool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      quoteNumber,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      quoteDate,
      validityDays,
      validityDate,
      subtotal,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      totalAmount,
      terms,
      managerName,
      products,
    } = req.body;

    if (!quoteNumber || !clientName) {
      throw new Error("رقم العرض واسم العميل مطلوبان");
    }

    const [quoteResult] = await conn.execute(
      `INSERT INTO quotes (
        quote_number, client_name, client_phone, client_email, client_address,
        quote_date, validity_days, validity_date, subtotal, discount_percent,
        discount_amount, tax_percent, tax_amount, total_amount, terms, manager_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        quoteNumber,
        clientName,
        clientPhone || null,
        clientEmail || null,
        clientAddress || null,
        quoteDate,
        validityDays || 14,
        validityDate,
        subtotal || 0,
        discountPercent || 0,
        discountAmount || 0,
        taxPercent || 15,
        taxAmount || 0,
        totalAmount || 0,
        terms || "",
        managerName || "",
      ],
    );

    const quoteId = quoteResult.insertId;

    if (products && Array.isArray(products) && products.length > 0) {
      for (const product of products) {
        await conn.execute(
          `INSERT INTO quote_items (quote_id, product_name, product_desc, unit, quantity, unit_price, total_price) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            quoteId,
            product.name || "صنف جديد",
            product.desc || null,
            product.unit || "قطعة",
            parseFloat(product.qty) || 0,
            parseFloat(product.price) || 0,
            (parseFloat(product.qty) || 0) * (parseFloat(product.price) || 0),
          ],
        );
      }
    }

    await conn.execute(
      `INSERT INTO quote_logs (quote_id, action, details) VALUES (?, ?, ?)`,
      [
        quoteId,
        "created",
        `تم إنشاء عرض السعر ${quoteNumber} للعميل ${clientName}`,
      ],
    );

    await conn.commit();

    res.json({
      success: true,
      message: "تم حفظ عرض السعر بنجاح",
      quoteId: quoteId,
      quoteNumber: quoteNumber,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error saving quote:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// جلب جميع عروض الأسعار
app.get("/api/quotes", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT q.*, (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as items_count 
       FROM quotes q ORDER BY q.created_at DESC`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب عرض سعر محدد
app.get("/api/quotes/:quoteNumber", async (req, res) => {
  try {
    const [quotes] = await mysqlPool.execute(
      "SELECT * FROM quotes WHERE quote_number = ?",
      [req.params.quoteNumber],
    );
    if (quotes.length === 0)
      return res
        .status(404)
        .json({ success: false, error: "عرض السعر غير موجود" });

    const [items] = await mysqlPool.execute(
      "SELECT * FROM quote_items WHERE quote_id = ?",
      [quotes[0].id],
    );
    res.json({ success: true, data: { ...quotes[0], items } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// البحث في عروض الأسعار
app.get("/api/quotes/search/:query", async (req, res) => {
  try {
    const searchTerm = `%${req.params.query}%`;
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM quotes WHERE client_name LIKE ? OR quote_number LIKE ? OR client_phone LIKE ? ORDER BY created_at DESC`,
      [searchTerm, searchTerm, searchTerm],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث حالة عرض السعر
app.patch("/api/quotes/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    await mysqlPool.execute("UPDATE quotes SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    res.json({ success: true, message: "تم تحديث الحالة بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// تحديث عرض سعر
app.put("/api/quotes/:id", async (req, res) => {
  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();

    const { products, ...quoteData } = req.body;

    await conn.execute(
      `UPDATE quotes SET client_name = ?, client_phone = ?, client_email = ?, client_address = ?,
       quote_date = ?, validity_days = ?, validity_date = ?, subtotal = ?, discount_percent = ?,
       discount_amount = ?, tax_percent = ?, tax_amount = ?, total_amount = ?, terms = ?, manager_name = ?
       WHERE id = ?`,
      [
        quoteData.clientName,
        quoteData.clientPhone,
        quoteData.clientEmail,
        quoteData.clientAddress,
        quoteData.quoteDate,
        quoteData.validityDays,
        quoteData.validityDate,
        quoteData.subtotal,
        quoteData.discountPercent,
        quoteData.discountAmount,
        quoteData.taxPercent,
        quoteData.taxAmount,
        quoteData.totalAmount,
        quoteData.terms,
        quoteData.managerName,
        req.params.id,
      ],
    );

    if (products && Array.isArray(products)) {
      await conn.execute("DELETE FROM quote_items WHERE quote_id = ?", [
        req.params.id,
      ]);
      for (const product of products) {
        await conn.execute(
          `INSERT INTO quote_items (quote_id, product_name, product_desc, unit, quantity, unit_price, total_price) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
            product.name,
            product.desc || null,
            product.unit || "قطعة",
            parseFloat(product.qty) || 0,
            parseFloat(product.price) || 0,
            (parseFloat(product.qty) || 0) * (parseFloat(product.price) || 0),
          ],
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "تم تحديث عرض السعر بنجاح" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// حذف عرض سعر
app.delete("/api/quotes/:id", async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM quotes WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم الحذف بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== تشغيل الخادم ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB: Products, Users, Orders, Offers`);
  console.log(`🗄️  MySQL: Quotes System (armax_test)`);
});
