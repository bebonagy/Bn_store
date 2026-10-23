// admin.js
import { db, appId, ADMIN_UID } from './firebase-config.js';
import { doc, setDoc, updateDoc, deleteDoc, collection, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// دالة لتهيئة التبويبات داخل لوحة الإدارة
window.initAdminTabs = () => {
  const tabBtns = document.querySelectorAll('#adminTabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => { 
      tabBtns.forEach(b => b.classList.remove('active')); 
      btn.classList.add('active'); 
      document.querySelectorAll('#adminDashboardView .tab-content').forEach(c => c.classList.remove('active-tab')); 
      document.getElementById(btn.dataset.target).classList.add('active-tab'); 
    });
  });
};

window.copyCustomerData = (text) => navigator.clipboard.writeText(text).then(() => window.showToast('تم النسخ 📋', 'success'));

// إدارة النسخ والباقات مؤقتاً في الواجهة
window.addVariantInput = (v = {nameAr: '', nameEn: '', price: ''}) => {
  const list = document.getElementById('variantsList');
  if(!list) return;
  const div = document.createElement('div');
  div.className = 'admin-item-row variant-row';
  div.style.alignItems = 'flex-end';
  div.innerHTML = `
      <div class="form-group" style="margin-bottom:0; flex:1;"><label>الاسم (عربي)</label><input type="text" class="var-ar" placeholder="مثال: شهر" value="${v.nameAr}"></div>
      <div class="form-group" style="margin-bottom:0; flex:1;"><label>الاسم (En)</label><input type="text" class="var-en" placeholder="1 Month" value="${v.nameEn}"></div>
      <div class="form-group" style="margin-bottom:0; flex:1;"><label>السعر (EGP)</label><input type="number" class="var-price" value="${v.price}"></div>
      <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="margin-bottom:2px; padding: 13px 15px;">✕</button>
  `;
  list.appendChild(div);
};

// 1. حقن واجهة الإدارة (HTML)
window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer'); if(!container) return;
  container.innerHTML = `
    <div id="tab-dashboard" class="tab-content active-tab">
      <div class="admin-section" style="border-color: var(--accent-neon);"><h4 style="color: var(--accent-neon); margin-bottom: 15px;">📊 إحصائيات المبيعات الدقيقة</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" id="adminStatsGrid"></div></div>
      <div class="admin-section"><h4>⚡ إعدادات العروض</h4><div class="form-group"><label>نص الإعلان</label><input type="text" id="admBannerAr"></div><div class="form-group"><label>موعد انتهاء العرض</label><input type="datetime-local" id="admBannerExpiry" style="background:#0b0b12; color:#fff; padding:10px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة السلايدر</h4><div class="form-group"><label>العنوان</label><input type="text" id="slideTitleInput"></div><div class="form-group"><label>الوصف</label><input type="text" id="slideDescInput"></div><div class="form-group"><label>صورة البانر</label><input type="file" id="slideImgFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div><button type="button" class="submit-btn" id="saveSlideBtn" style="width:100%; margin-bottom:15px;" onclick="window.addSlide()">➕ إضافة للسلايدر</button><div id="adminSlidesList"></div></div>
    </div>
    
    <div id="tab-orders" class="tab-content">
      <div class="admin-section"><h4>⏳ طلبات جديدة</h4><div id="adminOrdersPending" style="max-height:350px; overflow-y:auto;"></div></div>
      <div class="admin-section" style="margin-top: 20px; opacity: 0.9;"><h4>🗄️ أرشيف الطلبات</h4><div id="adminOrdersArchived" style="max-height:350px; overflow-y:auto;"></div></div>
    </div>
    
    <div id="tab-products" class="tab-content">
      <div class="admin-section" id="productFormSection">
        <h4>📦 إضافة أو تعديل منتج</h4>
        
        <div class="grid-2">
          <div class="form-group"><label>اسم المنتج (عربي)</label><input type="text" id="newProdTitleAr"></div>
          <div class="form-group"><label>اسم المنتج (إنجليزي)</label><input type="text" id="newProdTitleEn"></div>
          <div class="form-group"><label>السعر الأساسي (EGP)</label><input type="number" id="newProdPrice"></div>
          <div class="form-group"><label>السعر المشطوب (EGP)</label><input type="number" id="newProdOldPrice"></div>
          <div class="form-group"><label>القسم</label><select id="newProdCat"></select></div>
          <div class="form-group"><label>الكمية المتاحة</label><input type="number" id="newProdStock"></div>
          <div class="form-group"><label>الشارة (عربي)</label><input type="text" id="newProdBadgeAr" placeholder="تسليم فوري"></div>
          <div class="form-group"><label>الشارة (إنجليزي)</label><input type="text" id="newProdBadgeEn" placeholder="Instant Delivery"></div>
          <div class="form-group">
            <label>منصة اللعبة (اختياري - للألعاب فقط)</label>
            <select id="newProdPlatform">
              <option value="">-- بدون منصة --</option>
              <option value="steam">Steam</option>
              <option value="epic">Epic Games</option>
              <option value="playstation">PlayStation</option>
              <option value="xbox">Xbox</option>
              <option value="nintendo">Nintendo</option>
              <option value="ubisoft">Ubisoft</option>
              <option value="ea">EA App</option>
              <option value="battlenet">Battle.net</option>
            </select>
          </div>
          <div class="form-group"><label>مؤشر وقت التسليم</label><input type="text" id="newProdDeliveryTime" placeholder="مثال: ⚡ تسليم فوري"></div>
        </div>

        <div class="admin-section" style="border-color: var(--accent-neon); background: rgba(0,242,255,0.02);">
            <h4 style="color: var(--accent-neon);">💎 الباقات والنسخ المتعددة (Variants)</h4>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">اتركها فارغة إذا كان المنتج بخصائص وسعر واحد فقط.</p>
            <div id="variantsList" style="display:flex; flex-direction:column; gap:10px; margin-bottom: 15px;"></div>
            <button type="button" class="submit-btn" style="background:transparent; border:1px dashed var(--accent-neon); color:var(--accent-neon); width:100%;" onclick="window.addVariantInput()">+ إضافة باقة / نسخة جديدة</button>
        </div>

        <div class="admin-section" style="background: rgba(0,0,0,0.2);">
            <h4>⚡ المعلومات السريعة (Quick Info Box)</h4>
            <div class="grid-2">
                <div class="form-group"><label>نوع الحساب (عربي)</label><input type="text" id="qiAccountAr" placeholder="مثال: حساب خاص"></div>
                <div class="form-group"><label>نوع الحساب (إنجليزي)</label><input type="text" id="qiAccountEn" placeholder="مثال: Private Account"></div>
                <div class="form-group"><label>مدة الضمان (عربي)</label><input type="text" id="qiWarrantyAr" placeholder="مثال: 30 يوم"></div>
                <div class="form-group"><label>مدة الضمان (إنجليزي)</label><input type="text" id="qiWarrantyEn" placeholder="مثال: 30 Days"></div>
                <div class="form-group"><label>المنطقة / التفعيل (عربي)</label><input type="text" id="qiRegionAr" placeholder="مثال: عالمي"></div>
                <div class="form-group"><label>المنطقة / التفعيل (إنجليزي)</label><input type="text" id="qiRegionEn" placeholder="مثال: Global"></div>
            </div>
        </div>

        <div class="admin-section" style="background: rgba(0,0,0,0.2);">
            <h4>⚙️ متطلبات تشغيل اللعبة (للألعاب فقط)</h4>
            <div class="form-group"><label>المتطلبات (عربي)</label><textarea id="newProdReqAr" rows="3" placeholder="مثال: \nالمعالج: Core i5\nالرام: 8GB..."></textarea></div>
            <div class="form-group"><label>المتطلبات (إنجليزي)</label><textarea id="newProdReqEn" rows="3" placeholder="Processor: Core i5\nRAM: 8GB..."></textarea></div>
        </div>

        <div class="form-group"><label>صورة الغلاف</label><input type="file" id="newProdImgFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>الصورة الداخلية (البانر)</label><input type="file" id="newProdBannerFileInput" accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>معرض الصور الإضافية</label><input type="file" id="newProdGallery" multiple accept="image/*" style="background:#0b0b12; color:#fff; padding:8px; border-radius:5px; border:1px solid var(--border-color); width:100%;"></div>
        <div class="form-group"><label>🛒 اقتراحات السلة (ID)</label><input type="text" id="newProdCrossSell" placeholder="مثال: 171234, 175678"></div>
        <div class="form-group"><label>❓ الأسئلة الشائعة</label><textarea id="newProdFaq" rows="2"></textarea></div>
        <div class="form-group"><label>🏦 خزنة الأكواد الذكية (كود في كل سطر)</label><textarea id="newProdVault" style="font-family: monospace; direction: ltr;" rows="3"></textarea></div>
        <div class="form-group"><label>الوصف (عربي)</label><textarea id="newProdDescAr" rows="3"></textarea></div>
        <div class="form-group"><label>الوصف (إنجليزي)</label><textarea id="newProdDescEn" rows="3"></textarea></div>
        <button type="button" class="submit-btn" id="saveProductBtn" style="width:100%;" onclick="window.saveProduct()">➕ حفظ المنتج</button>
        <button type="button" class="cancel-btn" id="cancelEditBtn" style="width:100%; margin-top:10px; display:none;" onclick="window.cancelEdit()">إلغاء التعديل</button>
      </div>
      <div class="admin-section"><h4>📦 المنتجات الحالية</h4><div id="adminProductsList" style="max-height:300px; overflow-y:auto;"></div></div>
    </div>
    
    <div id="tab-users" class="tab-content">
      <div class="admin-section"><h4>👥 قائمة المستخدمين</h4><div id="adminUsersList" style="max-height:400px; overflow-y:auto;"></div></div>
    </div>
    
    <div id="tab-settings" class="tab-content">
      <div class="admin-section"><h4>🎁 إعدادات كود الخصم</h4><div class="grid-2"><div class="form-group"><label>كود الخصم</label><input type="text" id="admPromoCode"></div><div class="form-group"><label>نسبة الخصم (%)</label><input type="number" id="admPromoDiscount"></div></div></div>
      <div class="admin-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h4 style="margin:0;">💱 أسعار الصرف</h4>
          <button type="button" id="autoCurrencyBtn" onclick="window.autoUpdateCurrencies()" style="background:rgba(0,242,255,0.1); color:var(--accent-neon); border:1px solid var(--accent-neon); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">تحديث تلقائي 🔄</button>
        </div>
        <div class="grid-2"><div class="form-group"><label>SAR</label><input type="number" step="0.001" id="admRateSAR"></div><div class="form-group"><label>AED</label><input type="number" step="0.001" id="admRateAED"></div><div class="form-group"><label>USD</label><input type="number" step="0.0001" id="admRateUSD"></div></div>
      </div>
      <div class="admin-section"><h4>📢 إعدادات الدفع والواتساب</h4><div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div><div class="grid-2"><div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div><div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div><div class="form-group"><label>USDT</label><input type="text" id="admCrypto"></div></div><button type="button" id="saveConfigBtn" class="submit-btn" style="width:100%; margin-top:15px;" onclick="window.saveGeneralSettings()">💾 حفظ الإعدادات</button></div>
    </div>
    
    <div id="tab-seo" class="tab-content">
      <div class="admin-section">
        <h4>🔍 مدير محركات البحث (SEO)</h4>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:15px;">تحكم في الكلمات المفتاحية والوصف اللي بيظهر في جوجل عند البحث عن متجرك.</p>
        <div class="form-group"><label>عنوان الموقع (Meta Title)</label><input type="text" id="seoTitle" placeholder="BN MAX | متجر الخدمات الرقمية"></div>
        <div class="form-group"><label>وصف الموقع (Meta Description)</label><textarea id="seoDesc" rows="3" placeholder="اكتب وصف جذاب للمتجر..."></textarea></div>
        <div class="form-group"><label>الكلمات المفتاحية (Meta Keywords)</label><textarea id="seoKeywords" rows="2" placeholder="العاب، شحن، برامج، مفاتيح..."></textarea></div>
        <button type="button" class="submit-btn" style="width:100%;" onclick="window.saveSeoSettings()">💾 حفظ إعدادات السيو</button>
      </div>
    </div>
  `;
  window.initAdminTabs(); 
  if (window.renderCategoriesBar) window.renderCategoriesBar();
  window.loadAdminData();
};

// تحميل وتعبئة بيانات الإعدادات في الحقول
window.loadAdminData = () => {
  const s = window.storeState;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  
  setVal('admBannerAr', s.bannerAr);
  setVal('admBannerExpiry', s.bannerExpiry);
  setVal('admWhatsapp', s.whatsapp);
  setVal('admPromoCode', s.promoCode);
  setVal('admPromoDiscount', s.promoDiscount || 0);

  if (s.payments) {
    setVal('admInstapay', s.payments.instapay);
    setVal('admVodafone', s.payments.vodafone);
    setVal('admCrypto', s.payments.crypto);
  }

  if (s.rates) {
    setVal('admRateSAR', s.rates.SAR);
    setVal('admRateAED', s.rates.AED);
    setVal('admRateUSD', s.rates.USD);
  }

  window.renderAdminProducts();
  window.renderAdminOrders();
  window.renderAdminSlides();
  window.renderAdminStats();
};

// 2. تحديث العملات التلقائي
window.autoUpdateCurrencies = async () => {
  const btn = document.getElementById('autoCurrencyBtn');
  const origText = btn.innerHTML;
  btn.innerHTML = 'جاري التحديث ⏳...'; btn.disabled = true;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EGP');
    const data = await res.json();
    if(data && data.rates) {
      document.getElementById('admRateSAR').value = (1 / data.rates.SAR).toFixed(4);
      document.getElementById('admRateAED').value = (1 / data.rates.AED).toFixed(4);
      document.getElementById('admRateUSD').value = (1 / data.rates.USD).toFixed(4);
      window.showToast('تم تحديث الأسعار بقيمة العملة مقابل الجنيه! اضغط حفظ الإعدادات.', 'success');
    }
  } catch(e) { 
    window.showToast('فشل جلب الأسعار من الخادم، راجع اتصالك.', 'error'); 
  } finally {
    btn.innerHTML = origText; btn.disabled = false;
  }
};

// 3. عرض الإحصائيات والمستخدمين
window.renderAdminUsers = () => {
    const list = document.getElementById('adminUsersList'); if(!list) return;
    list.innerHTML = window.storeState.users.map(u => `<div class="admin-item-row" style="display:flex; justify-content:space-between;"><div><strong style="color:var(--accent-neon);">${window.sanitizeText(u.name)}</strong><br><small style="color:var(--text-muted);">${window.sanitizeText(u.email)}</small></div><small style="color:var(--text-muted);">${window.formatDate(u.createdAt)}</small></div>`).join('');
};

window.renderAdminStats = () => {
  const statsGrid = document.getElementById('adminStatsGrid'); if (!statsGrid) return;
  const orders = window.storeState.orders || [];
  const totalOrders = orders.length, pendingOrders = orders.filter(o => o.status === 'pending').length, completedOrders = orders.filter(o => o.status === 'completed').length;
  let totalRevenueEGP = 0;
  orders.forEach(o => { 
    if (o.status === 'completed') {
      let price = Number(o.finalPrice || 0), currency = o.currency || 'EGP', rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1);
      totalRevenueEGP += (price / rate);
    } 
  });
  statsGrid.innerHTML = `
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--accent-neon);">${totalOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معروضة</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: #ffcc00;">${pendingOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات معلقة ⏳</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 18px; font-weight: bold; color: var(--success);">${completedOrders}</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">طلبات مكتملة ✅</div></div>
    <div style="background: #0b0b12; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 16px; font-weight: bold; color: var(--accent-neon);">${totalRevenueEGP.toFixed(0)} EGP</div><div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">(≈ إجمالي المحول)</div></div>
  `;
};

// 4. إدارة الطلبات
window.renderAdminOrders = () => {
  const pendingList = document.getElementById('adminOrdersPending'), archivedList = document.getElementById('adminOrdersArchived');
  if (!pendingList || !archivedList) return; pendingList.replaceChildren(); archivedList.replaceChildren();

  const orders = window.storeState.orders || [], pendingOrders = orders.filter(o => o.status === 'pending'), archivedOrders = orders.filter(o => o.status !== 'pending');
  if (!pendingOrders.length) pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">لا توجد طلبات جديدة.</p>';
  if (!archivedOrders.length) archivedList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">الأرشيف فارغ.</p>';

  const createOrderHTML = (o, isArchived) => {
    const discountBadge = o.discountApplied > 0 ? `<span style="color:var(--success); font-weight:bold;">[خصم ${o.discountApplied}%]</span>` : '';
    const receiptView = o.receiptImage ? `<div style="margin-top:8px;"><a href="${o.receiptImage}" target="_blank" style="color:var(--accent-neon); text-decoration:underline;">📄 عرض الإيصال</a></div>` : '';
    const deleteBtn = isArchived ? `<button onclick="window.deleteAdminOrder('${o.id}')" style="position:absolute; bottom:10px; left:10px; background:rgba(255,68,68,0.2); color:var(--danger); border:1px solid var(--danger); padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">حذف نهائي 🗑️</button>` : '';

    let html = `<div class="admin-item-row" style="flex-direction:column; align-items:flex-start; position:relative; padding-bottom: ${isArchived ? '35px' : '10px'}"><span style="position:absolute; top:10px; left:10px; font-size:11px; color:var(--text-muted);">${window.formatDate(o.createdAt)}</span><div style="width:100%; margin-bottom:8px; line-height:1.6; padding-left: 100px;"><strong>الطلب:</strong> <span style="color:var(--accent-neon);">${o.productName}</span> | <strong>الإيميل:</strong> ${o.userEmail}<br><small><strong>السعر:</strong> <span style="color:var(--accent-neon);">${o.finalPrice} ${o.currency || 'EGP'}</span> ${discountBadge}</small><br><small><strong>محول من:</strong> ${o.senderInfo} | <strong style="color:var(--accent-neon);">رقم العملية:</strong> ${o.transactionId || 'غير مسجل'}<br><strong style="color:var(--accent-neon);">بيانات الاستلام:</strong> ${o.customerData} <button onclick="window.copyCustomerData('${o.customerData}')" style="background:var(--accent-neon); color:#000; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">نسخ</button></small><br>${receiptView}<small style="display:block; margin-top:5px;"><strong>الحالة:</strong> <span style="color:${o.status==='completed'?'var(--success)':o.status==='cancelled'?'var(--danger)':'#ffcc00'}">${o.status}</span></small>${isArchived && o.deliveredCode ? `<small style="display:block; color:var(--success);"><strong>الكود المُسلم:</strong> ${o.deliveredCode}</small>` : ''}</div>${deleteBtn}`;
    if (!isArchived) html += `<div style="display:flex; gap:8px; width:100%; flex-wrap:wrap; margin-top:5px; border-top:1px dashed var(--border-color); padding-top:10px;"><input type="text" id="code_${o.id}" placeholder="اكتب كود التفعيل هنا..." value="${o.deliveredCode || ''}" style="flex:1; padding:8px; border-radius:5px; background:#0b0b12; color:#fff; border:1px solid var(--border-color);"><button class="submit-btn" style="padding:8px 12px; flex:0;" onclick="window.updateOrderStatus('${o.id}', 'completed')">إكمال ✅</button><button class="cancel-btn" style="padding:8px 12px; flex:0; border-color:var(--danger); color:var(--danger);" onclick="window.updateOrderStatus('${o.id}', 'cancelled')">إلغاء ❌</button></div>`;
    html += `</div>`; return html;
  };
  pendingOrders.forEach(o => pendingList.insertAdjacentHTML('beforeend', createOrderHTML(o, false)));
  archivedOrders.forEach(o => archivedList.insertAdjacentHTML('beforeend', createOrderHTML(o, true)));
  if(orders.length >= window.adminOrdersLimit) archivedList.insertAdjacentHTML('beforeend', `<button type="button" class="load-more-btn" style="width:100%; padding:10px; background:transparent; color:var(--accent-neon); border:1px dashed var(--accent-neon); cursor:pointer;" onclick="window.loadMoreAdminOrders()">عرض المزيد ⬇️</button>`);
};

window.deleteAdminOrder = async (orderId) => { if (!window.checkIsAdmin() || !confirm('تأكيد الحذف النهائي؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId)); window.showToast('🗑️ تم الحذف', 'success'); } catch(e) {} };

window.updateOrderStatus = async (orderId, status) => {
  const codeInput = document.getElementById(`code_${orderId}`); if(!codeInput) return;
  try {
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    let codeToDeliver = codeInput.value.trim();
    const order = window.storeState.orders.find(o => o.id === orderId);
    
    if (status === 'cancelled') {
      if (order && order.productIds) {
        for (const pid of order.productIds) { 
          const prod = window.storeState.products.find(p => p.id === pid); 
          if (prod && prod.stockQuantity !== undefined) {
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { stockQuantity: prod.stockQuantity + 1, inStock: true }); 
          }
        }
      }
    } 
    else if (status === 'completed' && !codeToDeliver && order && order.productIds && order.productIds.length > 0) {
        let multiCodesArr = [];
        for (const pid of order.productIds) {
            const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', pid);
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(prodRef);
                if (!sfDoc.exists()) return;
                const data = sfDoc.data();
                if (data.vaultCodes) {
                    let codes = data.vaultCodes.split('\n').map(c => c.trim()).filter(c => c);
                    if (codes.length > 0) {
                        let extractedCode = codes.shift();
                        multiCodesArr.push(`${data.titleAr || data.title}: ${extractedCode}`);
                        transaction.update(prodRef, { vaultCodes: codes.join('\n') });
                    }
                }
            });
        }
        if (multiCodesArr.length > 0) codeToDeliver = multiCodesArr.join(' || ');
    }
    
    await updateDoc(orderRef, { status, deliveredCode: codeToDeliver, updatedAt: serverTimestamp() });
    
    if (status === 'completed' && typeof emailjs !== 'undefined' && order) {
        const confirmMsg = `تهانينا! لقد تم اكتمال طلبك بنجاح.<br><strong>المنتجات:</strong> ${order.productName}<br><strong>تفاصيل الاستلام/الأكواد:</strong><br><div class="highlight-box"><p>${codeToDeliver || 'تم التنفيذ مباشرة في حسابك.'}</p></div>`;
        emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: order.userEmail.split('@')[0], to_email: order.userEmail, custom_message: confirmMsg }).catch(err => console.log("Delivery Email Error"));
    }

    window.showToast('تم التحديث!', 'success');
  } catch(e) { window.showToast('خطأ في التحديث', 'error'); }
};

// 5. إدارة المنتجات وتحديث دالة الحفظ
window.saveProduct = async () => {
  if (!window.checkIsAdmin()) return;
  const titleAr = document.getElementById('newProdTitleAr').value, titleEn = document.getElementById('newProdTitleEn').value;
  const price = Number(document.getElementById('newProdPrice').value), oldPrice = Number(document.getElementById('newProdOldPrice')?.value) || 0;
  const stockQuantity = Number(document.getElementById('newProdStock')?.value) || 0;
  const category = document.getElementById('newProdCat')?.value || 'games';
  const badgeAr = document.getElementById('newProdBadgeAr')?.value || '', badgeEn = document.getElementById('newProdBadgeEn')?.value || '';
  const descAr = document.getElementById('newProdDescAr')?.value || '', descEn = document.getElementById('newProdDescEn')?.value || '';
  const deliveryTime = document.getElementById('newProdDeliveryTime')?.value || '';
  const faqText = document.getElementById('newProdFaq')?.value || '';
  const crossSellStr = document.getElementById('newProdCrossSell')?.value || '';
  const vaultCodes = document.getElementById('newProdVault')?.value || '';
  let crossSellIds = crossSellStr.split(',').map(id => id.trim()).filter(id => id);
  
  // استخراج الإضافات الجديدة
  const platform = document.getElementById('newProdPlatform')?.value || '';
  const reqAr = document.getElementById('newProdReqAr')?.value || '';
  const reqEn = document.getElementById('newProdReqEn')?.value || '';
  const quickInfo = {
    accountAr: document.getElementById('qiAccountAr')?.value || '',
    accountEn: document.getElementById('qiAccountEn')?.value || '',
    warrantyAr: document.getElementById('qiWarrantyAr')?.value || '',
    warrantyEn: document.getElementById('qiWarrantyEn')?.value || '',
    regionAr: document.getElementById('qiRegionAr')?.value || '',
    regionEn: document.getElementById('qiRegionEn')?.value || ''
  };

  // استخراج الباقات والنسخ
  const variants = [];
  document.querySelectorAll('#variantsList .variant-row').forEach(row => {
    const nameAr = row.querySelector('.var-ar').value.trim();
    const nameEn = row.querySelector('.var-en').value.trim();
    const vPrice = Number(row.querySelector('.var-price').value);
    if(nameAr && vPrice > 0) variants.push({ nameAr, nameEn, price: vPrice });
  });
  
  const coverInput = document.getElementById('newProdImgFileInput'), bannerInput = document.getElementById('newProdBannerFileInput'), galleryInput = document.getElementById('newProdGallery');
  const btn = document.getElementById('saveProductBtn');

  if (!titleAr || price <= 0) return window.showToast('تأكد من الاسم والسعر الأساسي!', 'error');
  const origText = btn.textContent; btn.textContent = 'جاري الحفظ ⏳...'; btn.disabled = true;

  try {
    let imgUrl = ''; if (coverInput && coverInput.files[0]) { imgUrl = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await window.compressImage(e.target.result)); r.readAsDataURL(coverInput.files[0]); }); } else if (window.editingProductId) { imgUrl = window.storeState.products.find(p => p.id === window.editingProductId)?.imgUrl || ''; }
    let bannerUrl = ''; if (bannerInput && bannerInput.files[0]) { bannerUrl = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await window.compressImage(e.target.result)); r.readAsDataURL(bannerInput.files[0]); }); } else if (window.editingProductId) { bannerUrl = window.storeState.products.find(p => p.id === window.editingProductId)?.bannerUrl || ''; }
    let gallery = window.editingProductId ? (window.storeState.products.find(p => p.id === window.editingProductId)?.gallery || []) : [];
    if (galleryInput && galleryInput.files.length > 0) { gallery = []; for (let i = 0; i < galleryInput.files.length; i++) { const base64 = await new Promise(res => { const r = new FileReader(); r.onload = async e => res(await window.compressImage(e.target.result)); r.readAsDataURL(galleryInput.files[i]); }); gallery.push(base64); } }

    const prodData = { 
      titleAr, titleEn, descAr, descEn, price, oldPrice, category, badgeAr, badgeEn, imgUrl, bannerUrl, gallery, 
      deliveryTime, faqText, crossSellIds, vaultCodes, inStock: stockQuantity > 0, stockQuantity,
      platform, reqAr, reqEn, quickInfo, variants
    };

    if (window.editingProductId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', window.editingProductId), prodData); window.showToast('✏️ تم التعديل!', 'success'); } 
    else { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', Date.now().toString()), prodData); window.showToast('📦 تمت الإضافة!', 'success'); }
    window.cancelEdit();
  } catch (e) { window.showToast('فشل العملية', 'error'); } finally { btn.textContent = origText; btn.disabled = false; }
};

window.editProduct = (id) => {
  const p = window.storeState.products.find(x => x.id === id); if(!p) return;
  document.getElementById('newProdTitleAr').value = p.titleAr || p.title || ''; document.getElementById('newProdTitleEn').value = p.titleEn || p.title || '';
  document.getElementById('newProdPrice').value = p.price || ''; document.getElementById('newProdOldPrice').value = p.oldPrice || '';
  document.getElementById('newProdCat').value = p.category || 'games'; document.getElementById('newProdStock').value = p.stockQuantity !== undefined ? p.stockQuantity : '';
  document.getElementById('newProdBadgeAr').value = p.badgeAr || p.badge || ''; document.getElementById('newProdBadgeEn').value = p.badgeEn || p.badge || '';
  document.getElementById('newProdDescAr').value = p.descAr || p.desc || ''; document.getElementById('newProdDescEn').value = p.descEn || p.desc || '';
  document.getElementById('newProdDeliveryTime').value = p.deliveryTime || ''; document.getElementById('newProdFaq').value = p.faqText || '';
  document.getElementById('newProdCrossSell').value = p.crossSellIds ? p.crossSellIds.join(', ') : ''; document.getElementById('newProdVault').value = p.vaultCodes || '';
  
  // الخانات الجديدة
  document.getElementById('newProdPlatform').value = p.platform || '';
  document.getElementById('newProdReqAr').value = p.reqAr || '';
  document.getElementById('newProdReqEn').value = p.reqEn || '';
  if(p.quickInfo) {
      document.getElementById('qiAccountAr').value = p.quickInfo.accountAr || '';
      document.getElementById('qiAccountEn').value = p.quickInfo.accountEn || '';
      document.getElementById('qiWarrantyAr').value = p.quickInfo.warrantyAr || '';
      document.getElementById('qiWarrantyEn').value = p.quickInfo.warrantyEn || '';
      document.getElementById('qiRegionAr').value = p.quickInfo.regionAr || '';
      document.getElementById('qiRegionEn').value = p.quickInfo.regionEn || '';
  }
  
  const list = document.getElementById('variantsList');
  if (list) {
      list.replaceChildren();
      if (p.variants && p.variants.length > 0) { p.variants.forEach(v => window.addVariantInput(v)); }
  }

  window.editingProductId = id; document.getElementById('saveProductBtn').innerHTML = '💾 حفظ التعديلات'; document.getElementById('cancelEditBtn').style.display = 'block'; document.getElementById('productFormSection').scrollIntoView({behavior: 'smooth'});
};

window.cancelEdit = () => {
  window.editingProductId = null; document.getElementById('saveProductBtn').innerHTML = '➕ إضافة المنتج'; document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('#productFormSection input, #productFormSection textarea, #productFormSection select').forEach(el => { if(el.id.startsWith('newProd') || el.id.startsWith('qi')) el.value = ''; });
  const list = document.getElementById('variantsList'); if(list) list.replaceChildren();
};

window.renderAdminProducts = () => {
  const list = document.getElementById('adminProductsList'); if (!list) return; list.replaceChildren();
  window.storeState.products.forEach(p => {
    const statusText = p.inStock && p.stockQuantity > 0 ? `متاح ✅ (${p.stockQuantity} قطعة)` : 'نفذت الكمية ⛔';
    const title = p.titleAr || p.title || '';
    let html = `<div class="admin-item-row"><span style="flex:1; line-height:1.6;">${title} - ${p.price}EGP (ID: <strong>${p.id}</strong>) <br><small><strong>${statusText}</strong></small></span><div style="display:flex; gap:8px;"><button class="submit-btn" style="padding:6px 12px; font-size:12px; flex:0;" onclick="window.editProduct('${p.id}')">تعديل</button><button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button></div></div>`;
    list.insertAdjacentHTML('beforeend', html);
  });
};
window.deleteProduct = async (id) => { if (!window.checkIsAdmin() || !confirm('تأكيد الحذف؟')) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); window.showToast('تم الحذف', 'success'); } catch (e) {} };

// 6. السلايدر
window.addSlide = async () => { 
  const title = document.getElementById('slideTitleInput').value.trim(), desc = document.getElementById('slideDescInput').value.trim(), fileInput = document.getElementById('slideImgFileInput'), btn = document.getElementById('saveSlideBtn');
  if (!title || !fileInput || !fileInput.files[0]) return window.showToast('أدخل البيانات!', 'error');
  const origText = btn.textContent; btn.textContent = 'جاري الإضافة ⏳...'; btn.disabled = true;
  try {
    const imgBase64 = await window.compressImage(fileInput.files[0].src || await new Promise(res=>{ const r = new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(fileInput.files[0]) }));
    const slides = window.storeState.slides ? [...window.storeState.slides] : []; slides.push({ title, desc, imgUrl: imgBase64 });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true });
    window.showToast('🖼️ تم إضافة البانر!', 'success');
  } catch(e) {} finally { btn.textContent = origText; btn.disabled = false; }
};
window.deleteSlide = async (idx) => { const slides = [...window.storeState.slides]; slides.splice(idx, 1); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true }); window.renderAdminSlides(); };
window.renderAdminSlides = () => { const list = document.getElementById('adminSlidesList'); if(list) list.innerHTML = (window.storeState.slides||[]).map((s,i) => `<div class="admin-item-row"><span style="flex:1;">${s.title}</span><button class="delete-btn" onclick="window.deleteSlide(${i})">حذف</button></div>`).join(''); };

// 7. حفظ إعدادات الموقع
window.saveGeneralSettings = async () => {
    try {
        const rates = { SAR: Number(document.getElementById('admRateSAR').value), AED: Number(document.getElementById('admRateAED').value), USD: Number(document.getElementById('admRateUSD').value) };
        const payments = { instapay: document.getElementById('admInstapay').value, vodafone: document.getElementById('admVodafone').value, crypto: document.getElementById('admCrypto').value };
        const promoCode = document.getElementById('admPromoCode').value;
        const promoDiscount = Number(document.getElementById('admPromoDiscount').value);
        const whatsapp = document.getElementById('admWhatsapp').value;
        const bannerAr = document.getElementById('admBannerAr').value;
        const bannerExpiry = document.getElementById('admBannerExpiry').value;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { rates, payments, promoCode, promoDiscount, whatsapp, bannerAr, bannerExpiry }, { merge: true });
        window.showToast('تم حفظ الإعدادات!', 'success');
    } catch(e) { window.showToast('خطأ في الحفظ', 'error'); }
};

window.saveSeoSettings = async () => {
    try {
        const seo = {
            title: document.getElementById('seoTitle').value.trim(),
            desc: document.getElementById('seoDesc').value.trim(),
            keywords: document.getElementById('seoKeywords').value.trim()
        };
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { seo }, { merge: true });
        window.showToast('✅ تم حفظ إعدادات السيو وتطبيقها!', 'success');
        if(seo.title) { document.getElementById('metaTitle').textContent = seo.title; document.getElementById('metaOgTitle').content = seo.title; }
        if(seo.desc) { document.getElementById('metaDesc').content = seo.desc; document.getElementById('metaOgDesc').content = seo.desc; }
        if(seo.keywords) document.getElementById('metaKeywords').content = seo.keywords;
    } catch (e) {
        window.showToast('خطأ في حفظ السيو', 'error');
    }
};
