import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, setDoc, doc, updateDoc, deleteDoc, onSnapshot, getDoc, query, where, serverTimestamp, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. الإعدادات الأساسية (Firebase)
// ==========================================
const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyBkt-5W1vLcGvWgJTv95KbpbrnMf7Rm0JU",
  authDomain: "bn-store-4f0c0.firebaseapp.com",
  projectId: "bn-store-4f0c0",
  storageBucket: "bn-store-4f0c0.firebasestorage.app",
  messagingSenderId: "281646513182",
  appId: "1:281646513182:web:002c7b1138fe5b8106c20f"
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "bn-store-main-app";

const ADMIN_UID = "CLdxfaDVBGMzQke9sjBXPIctBFQ2";
const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);
const sanitizeText = (val, maxLen = 250) => String(val ?? '').replace(/[<>]/g, '').trim().slice(0, maxLen);

// ==========================================
// 2. حالة المتجر الأساسية
// ==========================================
const RATES = Object.freeze({ EGP: 1, SAR: 0.077, AED: 0.075, USD: 0.020 });
let storeState = {
  bannerAr: "⚡ جاري التحميل...",
  whatsapp: "201200898990",
  promoCode: "BN10",
  promoDiscount: 10,
  payments: { instapay: "", vodafone: "", orange: "", crypto: "" },
  slides: [],
  products: [],
  orders: []
};
let currentUserProfile = null;
let currentProductId = null;

window.showToast = (msg, type = 'normal') => {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};

// ==========================================
// 3. التنقل وعرض المنتجات (UI Logic)
// ==========================================
const showView = (viewName) => {
  document.getElementById('homeView').style.display = viewName === 'home' ? 'block' : 'none';
  document.getElementById('productDetailsView').style.display = viewName === 'details' ? 'block' : 'none';
  if (viewName === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('logoBtn').addEventListener('click', () => showView('home'));
document.getElementById('backToHomeBtn').addEventListener('click', () => showView('home'));

window.renderProducts = () => {
  const grid = document.getElementById('productGrid');
  const currency = document.getElementById('currencySelect').value;
  const rate = RATES[currency] || 1;
  const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();
  
  grid.replaceChildren();
  const activeCatBtn = document.querySelector('.category-btn.active');
  const currentCategory = activeCatBtn ? activeCatBtn.dataset.cat : 'all';

  const filtered = storeState.products.filter(prod => {
    if (currentCategory !== 'all' && prod.category !== currentCategory) return false;
    if (searchVal && !String(prod.title).toLowerCase().includes(searchVal)) return false;
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-products-msg">🔍 لا توجد منتجات مطابقة حالياً.</div>';
    return;
  }

  filtered.forEach(prod => {
    const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
    const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
    // حساب التوفر بناءً على المخزون (لو موجود)
    const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);
    
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => window.openProductDetails(prod.id);
    
    card.innerHTML = `
      <div style="position:relative;">
        <span class="product-badge">${sanitizeText(prod.badge)}</span>
        <div class="product-img" style="background-image: url('${prod.imgUrl}'); border: ${prod.imgUrl ? 'none' : ''}">${prod.imgUrl ? '' : sanitizeText(prod.imgText)}</div>
        <h3 class="product-title">${sanitizeText(prod.title)}</h3>
        <p class="product-desc">${sanitizeText(prod.desc).substring(0, 60)}...</p>
      </div>
      <div>
        <div class="product-price-box">
          ${convertedOld ? `<span class="old-price">${convertedOld}${currency}</span>` : ''}
          <span class="product-price">${convertedPrice} ${currency}</span>
        </div>
        <button type="button" class="buy-btn ${inStock ? '' : 'out-of-stock-badge'}" ${inStock ? '' : 'disabled'}>
          ${inStock ? 'عرض التفاصيل' : 'نفذت الكمية'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
};

window.openProductDetails = (id) => {
  const prod = storeState.products.find(p => p.id === id);
  if (!prod) return;
  
  currentProductId = id;
  const currency = document.getElementById('currencySelect').value;
  const rate = RATES[currency] || 1;
  const convertedPrice = (prod.price * rate).toFixed(currency === 'EGP' ? 0 : 2);
  const convertedOld = (prod.oldPrice && prod.oldPrice > prod.price) ? (prod.oldPrice * rate).toFixed(currency === 'EGP' ? 0 : 2) : '';
  const inStock = prod.inStock && (prod.stockQuantity === undefined || prod.stockQuantity > 0);

  document.getElementById('detailTitle').textContent = prod.title;
  document.getElementById('detailDesc').textContent = prod.desc;
  document.getElementById('detailPrice').textContent = `${convertedPrice} ${currency}`;
  document.getElementById('detailOldPrice').textContent = convertedOld ? `${convertedOld} ${currency}` : '';
  document.getElementById('detailBadge').textContent = prod.badge;
  
  const imgBox = document.getElementById('detailImageBox');
  if(prod.imgUrl) {
    imgBox.style.backgroundImage = `url('${prod.imgUrl}')`;
    imgBox.style.border = 'none';
    imgBox.textContent = '';
  } else {
    imgBox.style.backgroundImage = 'none';
    imgBox.textContent = prod.imgText || prod.title;
  }

  const stockEl = document.getElementById('detailStock');
  const buyBtn = document.getElementById('detailBuyBtn');
  
  if (inStock) {
    stockEl.textContent = (prod.stockQuantity !== undefined) ? `${prod.stockQuantity} قطعة متاحة` : 'متوفر';
    stockEl.style.color = 'var(--success)';
    buyBtn.textContent = 'إتمام الشراء الآن';
    buyBtn.disabled = false;
    buyBtn.classList.remove('out-of-stock-badge');
  } else {
    stockEl.textContent = 'نفذت الكمية (Sold Out)';
    stockEl.style.color = 'var(--danger)';
    buyBtn.textContent = 'غير متوفر حالياً';
    buyBtn.disabled = true;
    buyBtn.classList.add('out-of-stock-badge');
  }
  showView('details');
};

// ==========================================
// 4. ربط الأحداث العامة (Events)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      window.renderProducts();
    });
  });

  document.getElementById('searchInput').addEventListener('input', window.renderProducts);
  document.getElementById('currencySelect').addEventListener('change', window.renderProducts);
  document.getElementById('detailBuyBtn').addEventListener('click', () => {
    if(currentProductId) document.getElementById('checkoutModal').style.display = 'flex';
  });

  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    });
  });

  document.getElementById('loginBtnNav').addEventListener('click', () => {
    if(currentUserProfile) {
      document.getElementById('userAccountModal').style.display = 'flex';
    } else {
      document.getElementById('authModal').style.display = 'flex';
    }
  });

  document.getElementById('adminBtnNav').addEventListener('click', () => {
    document.getElementById('adminModal').style.display = 'flex';
  });
});

// ==========================================
// 5. جلب البيانات من السيرفر (Firestore Sync)
// ==========================================
const initApp = () => {
  onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), snap => {
    const products = [];
    snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    storeState.products = products;
    window.renderProducts();
    if(checkIsAdmin()) window.renderAdminProducts();
  });

  onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      storeState.whatsapp = data.whatsapp || "201200898990";
      storeState.payments = data.payments || { instapay: "", vodafone: "", orange: "", crypto: "" };
      storeState.bannerAr = data.bannerAr || "⚡ مرحباً بك في المتجر";
      document.getElementById('flashBannerText').textContent = storeState.bannerAr;
      document.getElementById('whatsappBtn').href = `https://wa.me/${storeState.whatsapp}?text=استفسار:`;
      if(checkIsAdmin()) window.loadAdminData();
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtnNav');
    const adminBtn = document.getElementById('adminBtnNav');
    
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email };
      loginBtn.textContent = `👤 حسابي`;
      loginBtn.style.color = 'var(--accent-neon)';
      
      if (checkIsAdmin()) {
        adminBtn.style.display = 'inline-block';
        window.injectAdminDashboard();
        window.loadAdminData();
      }
    } else {
      currentUserProfile = null;
      loginBtn.textContent = '👤 تسجيل الدخول';
      loginBtn.style.color = '';
      adminBtn.style.display = 'none';
    }
  });
};

// ==========================================
// 6. لوحة تحكم الإدارة الكاملة (Admin Dashboard Logic)
// ==========================================
window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer');
  container.innerHTML = `
    <!-- إعدادات الدفع والتواصل -->
    <div class="admin-section">
      <h4>📢 إعدادات الإعلان والدفع</h4>
      <div class="form-group"><label>نص الإعلان (الـ Banner)</label><input type="text" id="admBannerAr"></div>
      <div class="grid-2">
        <div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div>
        <div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div>
        <div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div>
        <div class="form-group"><label>USDT (كريبتو)</label><input type="text" id="admCrypto"></div>
      </div>
      <button type="button" class="submit-btn" style="width:100%;" onclick="window.saveGeneralSettings()">💾 حفظ الإعدادات</button>
    </div>

    <!-- إضافة منتج جديد -->
    <div class="admin-section">
      <h4>📦 إضافة منتج جديد (بالمخزون)</h4>
      <div class="grid-2">
        <div class="form-group"><label>اسم المنتج</label><input type="text" id="newProdTitle"></div>
        <div class="form-group"><label>السعر (EGP)</label><input type="number" id="newProdPrice"></div>
        <div class="form-group"><label>السعر المشطوب</label><input type="number" id="newProdOldPrice"></div>
        <div class="form-group"><label>القسم</label>
          <select id="newProdCat">
            <option value="games">ألعاب</option>
            <option value="subs">اشتراكات</option>
            <option value="ai">ذكاء اصطناعي</option>
            <option value="software">برامج</option>
          </select>
        </div>
        <div class="form-group"><label>الكمية المتاحة (عدد القطع)</label><input type="number" id="newProdStock" placeholder="أدخل عدد القطع (مثال: 50)"></div>
        <div class="form-group"><label>الشارة (Badge)</label><input type="text" id="newProdBadge" placeholder="تسليم فوري"></div>
      </div>
      <div class="form-group"><label>رابط الصورة (HTTPS)</label><input type="text" id="newProdImgUrl"></div>
      <div class="form-group"><label>وصف المنتج</label><textarea id="newProdDesc" rows="2"></textarea></div>
      <button type="button" class="submit-btn" style="width:100%;" onclick="window.addNewProduct()">➕ إضافة المنتج للمتجر</button>
    </div>

    <!-- إدارة المنتجات الحالية -->
    <div class="admin-section">
      <h4>📦 المنتجات الحالية (التحكم)</h4>
      <div id="adminProductsList"></div>
    </div>
  `;
  document.getElementById('adminDashboardView').style.display = 'block';
  document.getElementById('adminLoginView').style.display = 'none';
};

window.loadAdminData = () => {
  document.getElementById('admBannerAr').value = storeState.bannerAr || '';
  document.getElementById('admWhatsapp').value = storeState.whatsapp || '';
  document.getElementById('admInstapay').value = storeState.payments?.instapay || '';
  document.getElementById('admVodafone').value = storeState.payments?.vodafone || '';
  document.getElementById('admCrypto').value = storeState.payments?.crypto || '';
  window.renderAdminProducts();
};

window.saveGeneralSettings = async () => {
  if (!checkIsAdmin()) return;
  const config = {
    bannerAr: document.getElementById('admBannerAr').value,
    whatsapp: document.getElementById('admWhatsapp').value,
    payments: {
      instapay: document.getElementById('admInstapay').value,
      vodafone: document.getElementById('admVodafone').value,
      crypto: document.getElementById('admCrypto').value
    }
  };
  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), config, { merge: true });
    showToast('💾 تم حفظ الإعدادات بنجاح!', 'success');
  } catch (e) { showToast('فشل الحفظ', 'error'); }
};

window.addNewProduct = async () => {
  if (!checkIsAdmin()) return;
  const title = document.getElementById('newProdTitle').value;
  const price = Number(document.getElementById('newProdPrice').value);
  const oldPrice = Number(document.getElementById('newProdOldPrice').value) || 0;
  const stockQuantity = Number(document.getElementById('newProdStock').value) || 0; // نظام المخزون الجديد
  const category = document.getElementById('newProdCat').value;
  const badge = document.getElementById('newProdBadge').value || 'متوفر';
  const imgUrl = document.getElementById('newProdImgUrl').value;
  const desc = document.getElementById('newProdDesc').value;

  if (!title || price <= 0) return showToast('تأكد من اسم المنتج والسعر!', 'error');

  const prodId = Date.now().toString();
  const newProd = {
    title, desc, price, oldPrice, category, badge, imgUrl,
    inStock: stockQuantity > 0, // هيكون متوفر بس لو العدد أكبر من صفر
    stockQuantity: stockQuantity
  };

  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prodId), newProd);
    showToast('📦 تمت إضافة المنتج!', 'success');
  } catch (e) { showToast('فشل إضافة المنتج', 'error'); }
};

window.renderAdminProducts = () => {
  const list = document.getElementById('adminProductsList');
  if (!list) return;
  list.replaceChildren();
  
  storeState.products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'admin-item-row';
    const statusText = p.inStock && p.stockQuantity > 0 ? `متاح ✅ (${p.stockQuantity} قطعة)` : 'نفذت الكمية ⛔';
    
    row.innerHTML = `
      <span style="flex:1;">${p.title} - ${p.price}EGP | <strong>${statusText}</strong></span>
      <button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button>
    `;
    list.appendChild(row);
  });
};

window.deleteProduct = async (id) => {
  if (!checkIsAdmin() || !confirm('تأكيد الحذف؟')) return;
  try {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
    showToast('تم الحذف', 'success');
  } catch (e) { showToast('فشل الحذف', 'error'); }
};

initApp();