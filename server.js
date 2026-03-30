require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const { OAuth2Client } = require("google-auth-library");

const app = express();

// ==================== Middleware ====================
app.use(cors());
app.use(express.json());

// ==================== DATABASE CONNECTIONS ====================

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/armax")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// MySQL
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

mysqlPool
  .getConnection()
  .then((conn) => {
    console.log("✅ Connected to MySQL (armax_test)");
    conn.release();
  })
  .catch((err) => console.error("❌ MySQL Error:", err.message));

// ==================== Google OAuth ====================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==================== MODELS (MongoDB) ====================

// Products
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

// Users
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, default: null },
  googleId: { type: String, default: null },
  avatar: { type: String, default: "" },
  phone: { type: String, default: "" },
  role: { type: String, enum: ["admin", "editor", "user"], default: "user" },
  status: { type: String, default: "active" },
  provider: { type: String, enum: ["local", "google"], default: "local" },
  lastLogin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Offers
const OfferSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  discount: Number,
  icon: String,
  color: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Orders
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

// ==================== HELPERS ====================

function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role || "user",
      name: user.name,
    },
    process.env.JWT_SECRET || "armax_secret_key",
    { expiresIn: "7d" },
  );
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    phone: user.phone,
    provider: user.provider,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

// ==================== MIDDLEWARE (AUTH) ====================

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "armax_secret_key",
    );

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required" });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة",
      });
    }

    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني مستخدم مسبقاً",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      phone: phone || "",
      provider: "local",
      role: "user",
      status: "active",
      lastLogin: new Date(),
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const loginValue = (email || username || "").trim().toLowerCase();

    if (!loginValue || !password) {
      return res.status(400).json({
        success: false,
        message: "بيانات تسجيل الدخول ناقصة",
      });
    }

    let user = null;

    if (loginValue.includes("@")) {
      user = await User.findOne({ email: loginValue });
    } else if (loginValue === "admin" && password === "123456") {
      // احتياطي مؤقت إذا كنت ما زلت تريد دخول الأدمن القديم
      const tempAdmin = {
        _id: "admin-temp-id",
        name: "المسؤول",
        email: "admin@local.test",
        role: "admin",
        status: "active",
        avatar: "",
        phone: "",
        provider: "local",
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      const token = jwt.sign(
        {
          userId: tempAdmin._id,
          email: tempAdmin.email,
          role: tempAdmin.role,
          name: tempAdmin.name,
        },
        process.env.JWT_SECRET || "armax_secret_key",
        { expiresIn: "7d" },
      );

      return res.json({
        success: true,
        token,
        user: tempAdmin,
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "الحساب غير مفعل",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "هذا الحساب مسجل عبر Google، استخدم تسجيل الدخول عبر Google",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور غير صحيحة",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Google Login
app.post("/api/auth/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "بيانات Google غير صالحة",
      });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || "Google User";
    const avatar = payload.picture || "";

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        provider: "google",
        role: "user",
        status: "active",
        lastLogin: new Date(),
      });
    } else {
      user.googleId = googleId;
      user.avatar = avatar;
      user.provider = "google";
      user.lastLogin = new Date();

      if (!user.name && name) {
        user.name = name;
      }

      await user.save();
    }

    const appToken = generateToken(user);

    return res.json({
      success: true,
      message: "تم تسجيل الدخول عبر Google بنجاح",
      token: appToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Google login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "فشل تسجيل الدخول عبر Google",
      error: error.message,
    });
  }
});

// Current user
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    if (req.user.userId === "admin-temp-id") {
      return res.json({
        success: true,
        user: {
          id: "admin-temp-id",
          name: "المسؤول",
          email: "admin@local.test",
          role: "admin",
          status: "active",
          avatar: "",
          phone: "",
          provider: "local",
        },
      });
    }

    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== PRODUCTS ====================

app.get("/api/products", async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { isActive: true };

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
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

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
      runValidators: true,
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

// ==================== USERS ====================

app.get("/api/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ORDERS ====================

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

// ==================== OFFERS ====================

app.get("/api/offers", async (req, res) => {
  try {
    const offers = await Offer.find({ isActive: true }).sort({ createdAt: -1 });
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

// ==================== QUOTES SYSTEM (MySQL) ====================

// Save quote
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
          `INSERT INTO quote_items (
            quote_id, product_name, product_desc, unit, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
      quoteId,
      quoteNumber,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error saving quote:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// Get all quotes
app.get("/api/quotes", async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT q.*, 
        (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) AS items_count
       FROM quotes q
       ORDER BY q.created_at DESC`,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single quote by number
app.get("/api/quotes/:quoteNumber", async (req, res) => {
  try {
    const [quotes] = await mysqlPool.execute(
      "SELECT * FROM quotes WHERE quote_number = ?",
      [req.params.quoteNumber],
    );

    if (quotes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "عرض السعر غير موجود",
      });
    }

    const [items] = await mysqlPool.execute(
      "SELECT * FROM quote_items WHERE quote_id = ?",
      [quotes[0].id],
    );

    res.json({
      success: true,
      data: { ...quotes[0], items },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search quotes
app.get("/api/quotes/search/:query", async (req, res) => {
  try {
    const searchTerm = `%${req.params.query}%`;

    const [rows] = await mysqlPool.execute(
      `SELECT * FROM quotes
       WHERE client_name LIKE ? OR quote_number LIKE ? OR client_phone LIKE ?
       ORDER BY created_at DESC`,
      [searchTerm, searchTerm, searchTerm],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update quote status
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

// Update quote
app.put("/api/quotes/:id", async (req, res) => {
  const conn = await mysqlPool.getConnection();

  try {
    await conn.beginTransaction();

    const { products, ...quoteData } = req.body;

    await conn.execute(
      `UPDATE quotes SET
        client_name = ?, client_phone = ?, client_email = ?, client_address = ?,
        quote_date = ?, validity_days = ?, validity_date = ?, subtotal = ?,
        discount_percent = ?, discount_amount = ?, tax_percent = ?, tax_amount = ?,
        total_amount = ?, terms = ?, manager_name = ?
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
          `INSERT INTO quote_items (
            quote_id, product_name, product_desc, unit, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
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

    await conn.commit();
    res.json({ success: true, message: "تم تحديث عرض السعر بنجاح" });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

// Delete quote
app.delete("/api/quotes/:id", async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM quotes WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم الحذف بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("📊 MongoDB: Products, Users, Orders, Offers");
  console.log("🗄️ MySQL: Quotes System (armax_test)");
});
