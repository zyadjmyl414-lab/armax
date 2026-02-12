// ==========================================
// إعدادات WhatsApp API (Whapi.Cloud) - إضافة جديدة
// ==========================================
const WHAPI_CONFIG = {
  apiToken: "vslbfdN8IXcN0XhZOcBJvJy6EW4EvANZ",
  recipientNumber: "966571805775",
  // الرابط الأساسي بدون الرقم - سيتم إضافته كـ query parameter
  apiUrl: "https://gate.whapi.cloud/messages/text",
};

// Sample Product Data
const products = [
  {
    id: 1,
    name: "طقم أواني طهي غير لاصق - 12 قطعة",
    category: "kitchen",
    categoryName: "أدوات المطبخ",
    price: 299,
    oldPrice: 450,
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&auto=format&fit=crop ",
    badge: "bestseller",
    badgeText: "الأكثر مبيعاً",
  },
  {
    id: 2,
    name: "مكنسة كهربائية متعددة الوظائف",
    category: "cleaning",
    categoryName: "منتجات التنظيف",
    price: 189,
    oldPrice: 250,
    image:
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400&auto=format&fit=crop ",
    badge: "",
    badgeText: "",
  },
  {
    id: 3,
    name: "مجموعة ألعاب أطفال تعليمية",
    category: "toys",
    categoryName: "ألعاب وهدايا",
    price: 99,
    oldPrice: 150,
    image:
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&auto=format&fit=crop ",
    badge: "new",
    badgeText: "جديد",
  },
  {
    id: 4,
    name: "صندوق هدايا فاخر مع تغليف",
    category: "gifts",
    categoryName: "هدايا وتغليف",
    price: 45,
    oldPrice: 70,
    image:
      "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&auto=format&fit=crop ",
    badge: "",
    badgeText: "",
  },
  {
    id: 5,
    name: "طقم أدوات يدوية منزلية - 25 قطعة",
    category: "tools",
    categoryName: "أدوات منزلية",
    price: 159,
    oldPrice: 220,
    image:
      "https://images.unsplash.com/photo-1581147036324-c17ac41dd161?w=400&auto=format&fit=crop ",
    badge: "bestseller",
    badgeText: "الأكثر مبيعاً",
  },
  {
    id: 6,
    name: "منظم خزانة ملابس متعدد الأقسام",
    category: "home",
    categoryName: "مستلزمات المنزل",
    price: 79,
    oldPrice: 120,
    image:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=400&auto=format&fit=crop ",
    badge: "",
    badgeText: "",
  },
  {
    id: 7,
    name: "خلاط كهربائي متعدد السرعات",
    category: "kitchen",
    categoryName: "أدوات المطبخ",
    price: 129,
    oldPrice: 199,
    image:
      "https://images.unsplash.com/photo-1570222094114-28a9d88a65d2?w=400&auto=format&fit=crop ",
    badge: "",
    badgeText: "",
  },
  {
    id: 8,
    name: "ممسحة بخار للأرضيات",
    category: "cleaning",
    categoryName: "منتجات التنظيف",
    price: 199,
    oldPrice: 280,
    image:
      "https://images.unsplash.com/photo-1585421514738-01798e1e9cf9?w=400&auto=format&fit=crop ",
    badge: "new",
    badgeText: "جديد",
  },
];

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
let currentLang = "ar";

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  renderProducts();
  createParticles();
  setupScrollEffects();
  setupIntersectionObserver();

  // Hide loading screen
  setTimeout(() => {
    document.getElementById("loading").classList.add("hidden");
  }, 1000);
});

updateCart();

// Render Products
function renderProducts(filter = "all") {
  const grid = document.getElementById("productsGrid");
  const filteredProducts =
    filter === "all" ? products : products.filter((p) => p.category === filter);

  grid.innerHTML = filteredProducts
    .map(
      (product) => `
                <div class="product-card fade-in">
                    ${product.badge ? `<span class="product-badge ${product.badge}">${product.badgeText}</span>` : ""}
                    <div class="product-image">
                        <img src="${product.image}" alt="${product.name}">
                        <div class="product-actions">
                            <button class="action-btn" onclick="quickView(${product.id})" title="عرض سريع">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn" onclick="addToCart(${product.id})" title="أضف للسلة">
                                <i class="fas fa-shopping-cart"></i>
                            </button>
                        </div>
                    </div>
                    <div class="product-info">
                        <div class="product-category">${product.categoryName}</div>
                        <h3 class="product-title">${product.name}</h3>
                        <div class="product-meta">
                            <div class="product-price">
                                <span class="price-current">${product.price} ر.س</span>
                                ${product.oldPrice ? `<span class="price-original">${product.oldPrice} ر.س</span>` : ""}
                                <span class="price-unit">للحبة (بالجملة)</span>
                            </div>
                            <button class="add-to-cart" onclick="addToCart(${product.id})">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `,
    )
    .join("");
}

// Filter Products
function filterProducts(category) {
  renderProducts(category);
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
}
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Cart Functions
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  const existingItem = cart.find((item) => item.id === productId);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  updateCart();
  saveCart();
  showToast(`تمت إضافة ${product.name} للسلة`);

  // Animate cart count
  const count = document.getElementById("cartCount");
  count.style.animation = "none";
  setTimeout(() => (count.style.animation = "bounce 0.3s ease"), 10);
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  updateCart();
  saveCart();
}

function updateQuantity(productId, change) {
  const item = cart.find((item) => item.id === productId);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      updateCart();
      saveCart();
    }
  }
}

function updateCart() {
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const cartFooter = document.getElementById("cartFooter");
  const cartTotalEl = document.getElementById("cartTotal");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = totalItems;

  if (cart.length === 0) {
    cartItems.innerHTML = `
                    <div class="cart-empty">
                        <i class="fas fa-shopping-basket"></i>
                        <h3>السلة فارغة</h3>
                        <p>ابدأ التسوق واضف منتجاتك هنا</p>
                    </div>
                `;
    cartFooter.style.display = "none";
  } else {
    cartItems.innerHTML = cart
      .map(
        (item) => `
                    <div class="cart-item">
                        <button class="remove-item" onclick="removeFromCart(${item.id})">
                            <i class="fas fa-times"></i>
                        </button>
                        <div class="cart-item-image">
                            <img src="${item.image}" alt="${item.name}">
                        </div>
                        <div class="cart-item-details">
                            <h4 class="cart-item-title">${item.name}</h4>
                            <div class="cart-item-price">${item.price} ر.س</div>
                            <div class="cart-item-quantity">
                                <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                                <span class="qty-value">${item.quantity}</span>
                                <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                            </div>
                        </div>
                    </div>
                `,
      )
      .join("");

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    cartTotalEl.textContent = `${total} ر.س`;
    cartFooter.style.display = "block";
  }
}

function toggleCart() {
  const sidebar = document.getElementById("cartSidebar");
  const overlay = document.getElementById("cartOverlay");
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
  document.body.style.overflow = sidebar.classList.contains("active")
    ? "hidden"
    : "";
}

// ==========================================
// دوال إتمام الطلب عبر WhatsApp API - إضافة جديدة
// ==========================================

// دالة checkout المُحسّنة لإرسال الرسائل تلقائياً عبر API
async function checkout() {
  if (cart.length === 0) return;

  const checkoutBtn = document.querySelector(".checkout-btn");
  const originalText = checkoutBtn.innerHTML;

  // تفعيل حالة التحميل
  checkoutBtn.disabled = true;
  checkoutBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';

  try {
    // جمع بيانات العميل
    const customerName = prompt("الرجاء إدخال اسمك الكامل:") || "عميل";
    const customerPhone = prompt("الرجاء إدخال رقم جوالك:") || "غير محدد";

    const cartData = {
      customerName,
      customerPhone,
      items: cart,
      total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      date: new Date().toLocaleString("ar-SA"),
    };

    const messageText = formatCartMessage(cartData);

    console.log("=== بدء إرسال الرسالة ===");
    console.log("إلى:", WHAPI_CONFIG.recipientNumber);
    console.log("الرسالة:", messageText);

    // إرسال الرسالة عبر API
    const result = await sendWhatsAppMessage(messageText);

    console.log("✅ نجاح الإرسال:", result);

    // نجاح الإرسال
    showToast("✅ تم إرسال طلبك بنجاح عبر واتساب! سنتواصل معك قريباً");

    // مسح السلة وإغلاقها
    cart = [];
    saveCart();
    updateCart();
    toggleCart();
  } catch (error) {
    console.error("❌ خطأ في الإرسال:", error);
    console.error("تفاصيل الخطأ:", error.message);

    showToast("⚠️ جاري التحويل إلى واتساب كخطة بديلة...");

    // الخطة البديلة: فتح واتساب ويب
    fallbackToCartWhatsApp();
  } finally {
    // إعادة الزر لحالته الطبيعية
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = originalText;
  }
}

// تنسيق رسالة السلة
function formatCartMessage(data) {
  const itemsText = data.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} - ${item.quantity} × ${item.price} ر.س`,
    )
    .join("\n");

  return `🛒 *طلب جديد من سلة التسوق - Aramex*

👤 *العميل:* ${data.customerName}
📱 *الجوال:* ${data.customerPhone}

📦 *المنتجات:*
${itemsText}

💰 *الإجمالي:* ${data.total} ر.س
🕐 *تاريخ الطلب:* ${data.date}

يرجى تأكيد الطلب في أقرب وقت`;
}

// إرسال الرسالة عبر Whapi.Cloud API - تم التصحيح
async function sendWhatsAppMessage(text) {
  // بناء الرابط مع إضافة الرقم كـ query parameter (مطلوب!)
  const url = `${WHAPI_CONFIG.apiUrl}?to=${WHAPI_CONFIG.recipientNumber}`;

  console.log("رابط الطلب:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHAPI_CONFIG.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      body: text,
      typing_time: 0,
      preview_url: false,
    }),
  });

  console.log("حالة الاستجابة:", response.status);

  const responseData = await response.json();
  console.log("بيانات الاستجابة:", responseData);

  if (!response.ok) {
    throw new Error(
      responseData.message ||
        responseData.error ||
        `فشل الإرسال: ${response.status}`,
    );
  }

  return responseData;
}

// خطة بديلة: فتح واتساب ويب إذا فشل API
function fallbackToCartWhatsApp() {
  let message = "طلب جديد من Aramex:%0A%0A";
  cart.forEach((item) => {
    message += `- ${item.name} (${item.quantity} × ${item.price} ر.س)%0A`;
  });
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  message += `%0Aالإجمالي: ${total} ر.س`;

  window.open(
    `https://wa.me/${WHAPI_CONFIG.recipientNumber}?text=${message}`,
    "_blank",
  );
}

// ==========================================
// نهاية الإضافات الجديدة
// ==========================================

// UI Functions
function toggleSearch() {
  const overlay = document.getElementById("searchOverlay");
  overlay.classList.toggle("active");
  if (overlay.classList.contains("active")) {
    document.getElementById("searchInput").focus();
  }
}

function toggleMobileMenu() {
  // Simple alert for demo - in production would toggle mobile menu
  showToast("قائمة الجوال - قيد التطوير");
}

function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  showToast(
    currentLang === "ar" ? "تم التحويل للعربية" : "Switched to English",
  );
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  toastMessage.textContent = message;
  toast.className = "toast show" + (type === "error" ? " error" : "");
  setTimeout(() => toast.class.remove("show"), 3000);
}

function quickView(productId) {
  const product = products.find((p) => p.id === productId);
  showToast(`عرض تفاصيل: ${product.name}`);
}

// Scroll Effects
function setupScrollEffects() {
  const header = document.getElementById("header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 100) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // Smooth scroll for navigation
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// Intersection Observer for animations
function setupIntersectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1 },
  );

  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
}

// Create floating particles
function createParticles() {
  const container = document.getElementById("particles");
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.width = Math.random() * 10 + 5 + "px";
    particle.style.height = particle.style.width;
    particle.style.animationDelay = Math.random() * 20 + "s";
    particle.style.animationDuration = Math.random() * 10 + 15 + "s";
    container.appendChild(particle);
  }
}

// Form submission
document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();
  showToast("تم إرسال طلبك بنجاح! سنتواصل معك قريباً");
  this.reset();
});

// Search functionality
document.getElementById("searchInput").addEventListener("input", function (e) {
  const query = e.target.value.toLowerCase();
  if (query.length > 2) {
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(query),
    );
    // In production, this would show search results
    console.log("Search results:", filtered);
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.getElementById("searchOverlay").classList.remove("active");
    document.getElementById("cartSidebar").classList.remove("active");
    document.getElementById("cartOverlay").classList.remove("active");
  }
});
