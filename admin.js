// admin.js
import { db, appId, ADMIN_UID } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const IMGBB_API_KEY = "84cc90fc7047a2277b2080e5e79b23d2";
window.tempGalleryUrls = [];

// 🛡️ [إصلاح رفع الإيصال والصور]: يعتمد الآن بسلاسة على window.auth المعرّف في firebase-config.js
window.uploadImageToImgBB = async (file, isReceipt = false) => {
    if (!isReceipt && !window.checkIsAdmin()) { window.showToast('غير مصرح برفع الصور!', 'error'); return null; }
    if (isReceipt && !window.auth?.currentUser) { window.showToast('يجب تسجيل الدخول لرفع الإيصال!', 'error'); return null; }
    const formData = new FormData(); formData.append('image', file);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data && data.success) return data.data.url;
        throw new Error(data.error?.message || 'فشل رفع الصورة');
    } catch (e) {
        console.error("ImgBB Upload Error:", e);
        window.showToast('فشل الرفع لـ ImgBB، تحقق من الاتصال.', 'error');
        return null;
    }
};

window.previewImage = (inputElement, previewBoxId) => {
    const box = document.getElementById(previewBoxId);
    if (!box) return;
    if (inputElement.files && inputElement.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { box.innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="Preview">`; };
        reader.readAsDataURL(inputElement.files[0]);
    } else {
        box.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">معاينة الصورة</span>';
    }
};

window.initAdminTabs = () => {
  const tabBtns = document.querySelectorAll('#adminTabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => { 
      tabBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); 
      document.querySelectorAll('#adminDashboardView .tab-content').forEach(c => c.classList.remove('active-tab')); 
      document.getElementById(btn.target || btn.dataset.target).classList.add('active-tab'); 
    });
  });
};

window.copyCustomerData = (text) => navigator.clipboard.writeText(text).then(() => window.showToast('تم النسخ 📋', 'success'));

window.addVariantInput = (v = {id: '', nameAr: '', nameEn: '', price: '', oldPrice: '', stockQuantity: '', vaultCodes: ''}) => {
  const list = document.getElementById('variantsList'); if(!list) return;
  const variantUniqueId = v.id || `v_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const div = document.createElement('div'); div.className = 'admin-item-row variant-row'; div.style.flexDirection = 'column'; div.style.alignItems = 'stretch';
  div.dataset.variantId = variantUniqueId;
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px dashed var(--border-color); padding-bottom:8px;">
        <strong style="color:var(--accent-neon); font-size:13px;">📦 تفاصيل الباقة</strong>
        <button type="button" class="delete-btn" onclick="this.parentElement.parentElement.remove()" style="padding: 4px 10px; font-size:11px;">حذف ✕</button>
    </div>
    <div class="grid-2">
        <div class="form-group" style="margin-bottom:10px;"><label>الاسم (عربي)</label><input type="text" class="var-ar" placeholder="مثال: شهر" value="${window.sanitizeText(v.nameAr, 100)}"></div>
        <div class="form-group" style="margin-bottom:10px;"><label>الاسم (En)</label><input type="text" class="var-en" placeholder="1 Month" value="${window.sanitizeText(v.nameEn, 100)}"></div>
        <div class="form-group" style="margin-bottom:10px;"><label>السعر (EGP)</label><input type="number" class="var-price" value="${v.price}"></div>
        <div class="form-group" style="margin-bottom:10px;"><label>السعر القديم (اختياري)</label><input type="number" class="var-old" placeholder="لعمل خصم" value="${v.oldPrice || ''}"></div>
        <div class="form-group" style="margin-bottom:10px;"><label>الكمية (اختياري)</label><input type="number" class="var-stock" placeholder="غير محدود" value="${v.stockQuantity !== undefined && v.stockQuantity !== null ? v.stockQuantity : ''}"></div>
    </div>
    <div class="form-group" style="margin-bottom:0;"><label>🏦 خزنة الأكواد الخاصة بالباقة (كود في كل سطر)</label><textarea class="var-vault" style="font-family: monospace; direction: ltr; background: rgba(0,0,0,0.5);" rows="2" placeholder="أكواد هذه الباقة فقط...">${window.sanitizeText(v.vaultCodes || '', 50000)}</textarea></div>
  `;
  list.appendChild(div);
};

window.addPromoInput = (p = {code: '', discount: '', expiry: '', productId: ''}) => {
  const list = document.getElementById('promosList'); if(!list) return;
  const div = document.createElement('div'); div.className = 'admin-item-row promo-row'; div.style.alignItems = 'flex-end';
  div.innerHTML = `
    <div class="form-group" style="margin-bottom:0; flex:1;"><label>الكود</label><input type="text" class="promo-code" placeholder="MAX50" value="${window.sanitizeText(p.code, 50)}"></div>
    <div class="form-group" style="margin-bottom:0; flex:1;"><label>الخصم (%)</label><input type="number" class="promo-disc" placeholder="10" value="${p.discount}"></div>
    <div class="form-group" style="margin-bottom:0; flex:1.5;"><label>ينتهي في</label><input type="datetime-local" class="promo-exp" style="background:#0b0b12; color:#fff; padding:10px; border-radius:5px; border:1px solid var(--border-color); width:100%;" value="${p.expiry}"></div>
    <div class="form-group" style="margin-bottom:0; flex:1.5;"><label>ID المنتج (للكل = فارغ)</label><input type="text" class="promo-prod" placeholder="فارغ = الكل" value="${window.sanitizeText(p.productId || '', 100)}" style="background:rgba(0,242,255,0.05);"></div>
    <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="margin-bottom:2px; padding: 13px 15px;">✕</button>`;
  list.appendChild(div);
};

window.handleSelectChange = (selectEl, customInputId) => {
    const customInput = document.getElementById(customInputId);
    if (!customInput) return;
    if (selectEl.value === 'other') { customInput.style.display = 'block'; customInput.value = ''; } 
    else { customInput.style.display = 'none'; customInput.value = selectEl.value; }
};

window.injectAdminDashboard = () => {
  const container = document.getElementById('adminSectionsContainer'); 
  if(!container || container.innerHTML.includes('adminStatsGrid')) return; 

  container.innerHTML = `
    <div id="tab-dashboard" class="tab-content active-tab">
      <div class="admin-section" style="border-color: var(--accent-neon);"><h4 style="color: var(--accent-neon); margin-bottom: 15px;">📊 إحصائيات المبيعات الدقيقة</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" id="adminStatsGrid"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة كافر الموقع الثابت (Hero Banner)</h4><div class="grid-2"><div class="form-group"><label>عنوان (عربي)</label><input type="text" id="heroTitleAr"></div><div class="form-group"><label>عنوان (En)</label><input type="text" id="heroTitleEn"></div></div><div class="form-group"><label>وصف (عربي)</label><textarea id="heroDescAr" rows="2"></textarea></div><div class="form-group"><label>وصف (En)</label><textarea id="heroDescEn" rows="2"></textarea></div><div class="grid-2"><div class="form-group"><label>نص الزر (عربي)</label><input type="text" id="heroBtnAr"></div><div class="form-group"><label>نص الزر (En)</label><input type="text" id="heroBtnEn"></div></div><div class="form-group"><label>صورة خلفية</label><input type="file" id="heroBgFileInput" accept="image/*" class="file-input-styled"></div><button type="button" class="submit-btn" style="width:100%;" onclick="window.saveHeroConfig()">💾 حفظ إعدادات الكافر</button></div>
      <div class="admin-section"><h4>⚡ إعدادات العروض</h4><div class="form-group"><label>نص الإعلان</label><input type="text" id="admBannerAr"></div><div class="form-group"><label>موعد الانتهاء</label><input type="datetime-local" id="admBannerExpiry" class="file-input-styled"></div></div>
      <div class="admin-section"><h4>🖼️ إدارة السلايدر المتحرك (أقصى حد 6)</h4><div class="form-group"><label>العنوان</label><input type="text" id="slideTitleInput"></div><div class="form-group"><label>الوصف</label><input type="text" id="slideDescInput"></div><div class="form-group"><label>الرابط (اختياري)</label><input type="text" id="slideLinkInput" placeholder="?product=123"></div><div class="form-group"><label>الصورة</label><input type="file" id="slideImgFileInput" accept="image/*" class="file-input-styled"></div><button type="button" class="submit-btn" id="saveSlideBtn" style="width:100%; margin-bottom:15px;" onclick="window.addSlide()">➕ إضافة للسلايدر</button><div id="adminSlidesList"></div></div>
    </div>
    
    <div id="tab-orders" class="tab-content">
      <div class="admin-section">
        <h4>⏳ طلبات جديدة</h4>
        <input type="search" id="adminOrderSearch" class="admin-search-bar" placeholder="بحث برقم العملية، الإيميل، أو اسم المنتج..." oninput="window.renderAdminOrders()">
        <div id="adminOrdersPending" style="max-height:350px; overflow-y:auto;"></div>
      </div>
      <div class="admin-section" style="margin-top: 20px; opacity: 0.9;"><h4>🗄️ أرشيف الطلبات</h4><div id="adminOrdersArchived" style="max-height:350px; overflow-y:auto;"></div></div>
    </div>
    
    <div id="tab-products" class="tab-content">
      <div class="admin-section-grid" id="productFormSection">
        <div class="admin-sub-section">
            <h5>📁 المعلومات الأساسية</h5>
            <div class="grid-2">
                <div class="toggle-row"><label class="switch"><input type="checkbox" id="newProdActive" checked><span class="slider"></span></label><span>منتج مفعل (يظهر للعملاء)</span></div>
                <div class="toggle-row"><label class="switch"><input type="checkbox" id="newProdFeatured"><span class="slider"></span></label><span style="color:var(--accent-neon);">⭐ تثبيت في أعلى الصفحة</span></div>
            </div>
            <div class="grid-2">
              <div class="form-group"><label>الاسم (عربي)</label><input type="text" id="newProdTitleAr"></div>
              <div class="form-group"><label>الاسم (إنجليزي)</label><input type="text" id="newProdTitleEn"></div>
              <div class="form-group"><label>القسم</label><select id="newProdCat"></select></div>
              <div class="form-group"><label>المنصة (للألعاب)</label><select id="newProdPlatform"><option value="">-- بدون --</option><option value="steam">Steam</option><option value="epic">Epic Games</option><option value="playstation">PlayStation</option><option value="xbox">Xbox</option><option value="nintendo">Nintendo</option><option value="ubisoft">Ubisoft</option><option value="ea">EA App</option><option value="battlenet">Battle.net</option></select></div>
            </div>
            <div class="form-group" style="margin-bottom:0;"><label>كلمات البحث (Tags) - افصل بفاصلة</label><input type="text" id="newProdTags" placeholder="مثال: كورة, قدم, فيفا, fifa"></div>
        </div>

        <div class="admin-sub-section" style="border-color: var(--accent-neon);">
            <h5 style="color: var(--accent-neon);">💰 التسعير والباقات (Variants)</h5>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:15px;">إذا أضفت باقات، سيتم عرض سعر أرخص باقة كسعر أساسي للمنتج تلقائياً.</p>
            <div class="grid-2" id="mainPriceFields">
              <div class="form-group"><label>السعر الأساسي (EGP)</label><input type="number" id="newProdPrice"></div>
              <div class="form-group"><label>السعر القديم (EGP)</label><input type="number" id="newProdOldPrice"></div>
            </div>
            <div class="form-group" id="mainStockField"><label>الكمية العامة</label><input type="number" id="newProdStock" placeholder="فارغ = غير محدود"></div>
            <div id="variantsList" style="display:flex; flex-direction:column; gap:10px; margin-bottom: 15px;"></div>
            <button type="button" class="submit-btn" style="background:transparent; border:1px dashed var(--accent-neon); color:var(--accent-neon); width:100%;" onclick="window.addVariantInput()">+ إضافة باقة / نسخة جديدة</button>
        </div>

        <div class="admin-sub-section" style="border-color: var(--accent-purple);">
            <h5 style="color: var(--accent-purple);">🎁 عروض الباندل المزدوج (Bundle Deals)</h5>
            <div class="grid-2">
              <div class="form-group"><label>ID المنتج الإضافي للباندل</label><input type="text" id="newProdBundleId" placeholder="اكتب ID المنتج الثاني..."></div>
              <div class="form-group"><label>نسبة خصم الباندل (%)</label><input type="number" id="newProdBundleDiscount" placeholder="مثال: 15"></div>
            </div>
        </div>

        <div class="admin-sub-section">
            <h5>📦 التوصيل والاستلام</h5>
            <div class="toggle-row" style="margin-bottom:15px;"><label class="switch"><input type="checkbox" id="newProdRequireData" checked><span class="slider"></span></label><span>يطلب بيانات العميل (آيدي/إيميل) وقت الدفع</span></div>
            <div class="grid-2">
                <div class="form-group">
                    <label>وقت التسليم</label>
                    <select id="newProdDeliverySelect" onchange="window.handleSelectChange(this, 'newProdDeliveryTime')"><option value="">-- بدون --</option><option value="⚡ تسليم فوري">⚡ تسليم فوري</option><option value="⏱️ من 5 إلى 15 دقيقة">⏱️ من 5 إلى 15 دقيقة</option><option value="⏳ خلال ساعة">⏳ خلال ساعة</option><option value="📅 خلال 24 ساعة">📅 خلال 24 ساعة</option><option value="other">كتابة يدوية...</option></select>
                    <input type="text" id="newProdDeliveryTime" style="display:none; margin-top:5px;" placeholder="اكتب وقت التسليم...">
                </div>
                <div class="form-group"><label>رابط تسليم خارجي (للبرامج)</label><input type="text" id="newProdExternalLink" placeholder="https://..."></div>
            </div>
            <div class="form-group" style="margin-bottom:0;"><label>🏦 الخزنة العامة للأكواد (للمنتج بدون باقات - كود في كل سطر)</label><textarea id="newProdVault" style="font-family: monospace; direction: ltr;" rows="3" placeholder="كود في كل سطر..."></textarea></div>
        </div>

        <div class="admin-sub-section">
            <h5>⚡ المعلومات السريعة (تظهر بجوار السعر)</h5>
            <div class="grid-2">
                <div class="form-group">
                  <label>نوع الحساب</label>
                  <select id="qiAccountSelect" onchange="window.handleSelectChange(this, 'qiAccountCustom')"><option value="">-- اختار --</option><option value="حساب خاص | Private Account">حساب خاص | Private</option><option value="حساب مشترك | Shared Account">حساب مشترك | Shared</option><option value="مفتاح تفعيل | CD Key">مفتاح تفعيل | CD Key</option><option value="شحن مباشر | Direct Top-up">شحن مباشر | Direct Top-up</option><option value="other">أخرى...</option></select>
                  <input type="text" id="qiAccountCustom" style="display:none; margin-top:5px;" placeholder="عربي | إنجليزي">
                </div>
                <div class="form-group">
                  <label>الضمان</label>
                  <select id="qiWarrantySelect" onchange="window.handleSelectChange(this, 'qiWarrantyCustom')"><option value="">-- اختار --</option><option value="مدى الحياة | Lifetime">مدى الحياة | Lifetime</option><option value="سنة كاملة | 1 Year">سنة كاملة | 1 Year</option><option value="30 يوم | 30 Days">30 يوم | 30 Days</option><option value="بدون ضمان | No Warranty">بدون ضمان | No</option><option value="other">أخرى...</option></select>
                  <input type="text" id="qiWarrantyCustom" style="display:none; margin-top:5px;" placeholder="عربي | إنجليزي">
                </div>
                <div class="form-group">
                  <label>التفعيل/المنطقة</label>
                  <select id="qiRegionSelect" onchange="window.handleSelectChange(this, 'qiRegionCustom')"><option value="">-- اختار --</option><option value="عالمي | Global">عالمي | Global</option><option value="تركي | Turkey">تركي | Turkey</option><option value="أرجنتيني | Argentina">أرجنتيني | Argentina</option><option value="مصري | Egypt">مصري | Egypt</option><option value="other">أخرى...</option></select>
                  <input type="text" id="qiRegionCustom" style="display:none; margin-top:5px;" placeholder="عربي | إنجليزي">
                </div>
            </div>
        </div>

        <div class="admin-sub-section">
            <h5>🖼️ الوسائط والصور</h5>
            <div class="form-group"><label>رابط فيديو يوتيوب (Trailer)</label><input type="text" id="newProdTrailer" placeholder="https://youtube.com/watch?v=..."></div>
            <div class="grid-2">
                <div><label>صورة الغلاف (مربع)</label><input type="file" id="newProdImgFileInput" accept="image/*" class="file-input-styled" onchange="window.previewImage(this, 'previewCover')"><div id="previewCover" class="image-preview-box"><span>معاينة الغلاف</span></div></div>
                <div><label>البانر الداخلي (مستطيل)</label><input type="file" id="newProdBannerFileInput" accept="image/*" class="file-input-styled" onchange="window.previewImage(this, 'previewBanner')"><div id="previewBanner" class="image-preview-box"><span>معاينة البانر</span></div></div>
            </div>
            <div class="form-group" style="margin-top:15px;"><label>معرض الصور الإضافية (Gallery)</label><input type="file" id="newProdGallery" multiple accept="image/*" class="file-input-styled"><div id="previewGallery" class="gallery-preview-grid"></div></div>
        </div>

        <div class="admin-sub-section">
            <h5>📝 التفاصيل والوصف</h5>
            <div class="grid-2">
              <div class="form-group"><label>الوصف (عربي)</label><textarea id="newProdDescAr" rows="3"></textarea></div>
              <div class="form-group"><label>الوصف (إنجليزي)</label><textarea id="newProdDescEn" rows="3"></textarea></div>
              <div class="form-group"><label>متطلبات التشغيل (عربي)</label><textarea id="newProdReqAr" rows="2"></textarea></div>
              <div class="form-group"><label>متطلبات التشغيل (إنجليزي)</label><textarea id="newProdReqEn" rows="2"></textarea></div>
            </div>
            <div class="form-group"><label>❓ الأسئلة الشائعة</label><textarea id="newProdFaq" rows="2"></textarea></div>
            <div class="grid-2"><div class="form-group"><label>شارة عربي</label><input type="text" id="newProdBadgeAr" placeholder="🔥 عرض حصري"></div><div class="form-group"><label>شارة En</label><input type="text" id="newProdBadgeEn" placeholder="🔥 Exclusive"></div></div>
            <div class="form-group" style="margin-bottom:0;"><label>🛒 اقتراحات السلة (IDs)</label><input type="text" id="newProdCrossSell" placeholder="مثال: 171234, 175678"></div>
        </div>

        <button type="button" class="submit-btn" id="saveProductBtn" style="width:100%; font-size:16px; padding:18px;" onclick="window.saveProduct()">➕ حفظ المنتج ونشره</button>
        <button type="button" class="cancel-btn" id="cancelEditBtn" style="width:100%; margin-top:5px; display:none;" onclick="window.cancelEdit()">إلغاء التعديل والتراجع</button>
      </div>
      <div class="admin-section" style="margin-top:25px;">
        <h4>📦 المنتجات الحالية</h4>
        <input type="search" id="adminProductSearch" class="admin-search-bar" placeholder="بحث بالاسم أو ID المنتج..." oninput="window.renderAdminProducts()">
        <div id="adminProductsList" style="max-height:400px; overflow-y:auto;"></div>
      </div>
    </div>
    
    <div id="tab-users" class="tab-content"><div class="admin-section"><h4>👥 قائمة المستخدمين</h4><div id="adminUsersList" style="max-height:400px; overflow-y:auto;"></div></div></div>
    
    <div id="tab-settings" class="tab-content">
      <div class="admin-section" style="border-color: var(--accent-neon); background: rgba(0,242,255,0.02);"><h4 style="color: var(--accent-neon);">🎁 إعدادات الكوبونات الديناميكية</h4><div id="promosList" style="display:flex; flex-direction:column; gap:10px; margin-bottom: 15px;"></div><button type="button" class="submit-btn" style="background:transparent; border:1px dashed var(--accent-neon); color:var(--accent-neon); width:100%;" onclick="window.addPromoInput()">+ إضافة كوبون جديد</button></div>
      <div class="admin-section"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"><h4 style="margin:0;">💱 أسعار الصرف</h4><button type="button" id="autoCurrencyBtn" onclick="window.autoUpdateCurrencies()" class="submit-btn" style="padding:6px 12px; font-size:12px;">تحديث 🔄</button></div><div class="grid-2"><div class="form-group"><label>SAR</label><input type="number" step="0.001" id="admRateSAR"></div><div class="form-group"><label>AED</label><input type="number" step="0.001" id="admRateAED"></div><div class="form-group"><label>USD</label><input type="number" step="0.0001" id="admRateUSD"></div></div></div>
      <div class="admin-section">
        <h4>📢 الدفع والواتساب</h4>
        <div class="form-group"><label>رقم الواتساب</label><input type="text" id="admWhatsapp"></div>
        <div class="grid-2">
            <div class="form-group"><label>إنستا باي</label><input type="text" id="admInstapay"></div>
            <div class="form-group"><label>فودافون كاش</label><input type="text" id="admVodafone"></div>
            <div class="form-group"><label>أورنج كاش (Orange Cash)</label><input type="text" id="admOrange"></div>
            <div class="form-group"><label>USDT (TRC20)</label><input type="text" id="admCryptoTRC20"></div>
            <div class="form-group"><label>USDT (BEP20)</label><input type="text" id="admCryptoBEP20"></div>
        </div>
        <button type="button" id="saveConfigBtn" class="submit-btn" style="width:100%; margin-top:15px;" onclick="window.saveGeneralSettings()">💾 حفظ الإعدادات</button>
      </div>
    </div>
    
    <div id="tab-seo" class="tab-content"><div class="admin-section"><h4>🔍 مدير السيو (SEO)</h4><div class="form-group"><label>عنوان الموقع</label><input type="text" id="seoTitle"></div><div class="form-group"><label>الوصف</label><textarea id="seoDesc" rows="3"></textarea></div><div class="form-group"><label>كلمات مفتاحية</label><textarea id="seoKeywords" rows="2"></textarea></div><button type="button" class="submit-btn" style="width:100%;" onclick="window.saveSeoSettings()">💾 حفظ</button></div></div>
  `;
  window.initAdminTabs(); 
  if (window.renderCategoriesBar) window.renderCategoriesBar();
  window.loadAdminData();
};

window.loadAdminData = async () => {
  const s = window.storeState; const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setVal('admBannerAr', s.bannerAr); setVal('admBannerExpiry', s.bannerExpiry); setVal('admWhatsapp', s.whatsapp);
  if (s.heroConfig) { setVal('heroTitleAr', s.heroConfig.titleAr); setVal('heroTitleEn', s.heroConfig.titleEn); setVal('heroDescAr', s.heroConfig.descAr); setVal('heroDescEn', s.heroConfig.descEn); setVal('heroBtnAr', s.heroConfig.btnTextAr); setVal('heroBtnEn', s.heroConfig.btnTextEn); }
  const promosList = document.getElementById('promosList'); if (promosList) { promosList.replaceChildren(); if (s.promos) s.promos.forEach(p => window.addPromoInput(p)); }
  if (s.payments) { setVal('admInstapay', s.payments.instapay); setVal('admVodafone', s.payments.vodafone); setVal('admOrange', s.payments.orange); setVal('admCryptoTRC20', s.payments.cryptoTRC20); setVal('admCryptoBEP20', s.payments.cryptoBEP20); }
  if (s.rates) { setVal('admRateSAR', s.rates.SAR); setVal('admRateAED', s.rates.AED); setVal('admRateUSD', s.rates.USD); }
  
  try {
      const cfgSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'));
      if (cfgSnap.exists() && cfgSnap.data().seo) {
          const seo = cfgSnap.data().seo;
          setVal('seoTitle', seo.title);
          setVal('seoDesc', seo.desc);
          setVal('seoKeywords', seo.keywords);
      }
  } catch(e) {}

  window.renderAdminProducts(); window.renderAdminOrders(); window.renderAdminSlides(); window.renderAdminStats();
};

window.saveHeroConfig = async () => {
  if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error');
  try {
      const bgInput = document.getElementById('heroBgFileInput'); let bgUrl = window.storeState.heroConfig?.bgUrl || '';
      if (bgInput && bgInput.files[0]) { const uploadedUrl = await window.uploadImageToImgBB(bgInput.files[0]); if (uploadedUrl) bgUrl = uploadedUrl; }
      const heroConfig = { titleAr: document.getElementById('heroTitleAr').value.trim(), titleEn: document.getElementById('heroTitleEn').value.trim(), descAr: document.getElementById('heroDescAr').value.trim(), descEn: document.getElementById('heroDescEn').value.trim(), btnTextAr: document.getElementById('heroBtnAr').value.trim(), btnTextEn: document.getElementById('heroBtnEn').value.trim(), bgUrl };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { heroConfig }, { merge: true });
      window.storeState.heroConfig = heroConfig; window.renderPromoSlider(); window.showToast('✅ تم حفظ إعدادات الكافر بنجاح!', 'success');
  } catch (e) { window.showToast('فشل حفظ إعدادات الكافر', 'error'); }
};

window.autoUpdateCurrencies = async () => {
  if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error');
  const btn = document.getElementById('autoCurrencyBtn'); const origText = btn.innerHTML; btn.innerHTML = 'جاري التحديث...'; btn.disabled = true;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EGP'); if(!res.ok) throw new Error('API Error'); const data = await res.json();
    if(data && data.rates && data.rates.SAR) { 
      document.getElementById('admRateSAR').value = (1 / data.rates.SAR).toFixed(4); document.getElementById('admRateAED').value = (1 / data.rates.AED).toFixed(4); document.getElementById('admRateUSD').value = (1 / data.rates.USD).toFixed(4);
      window.showToast('تم تحديث الأسعار! اضغط حفظ الإعدادات.', 'success');
    } else throw new Error('Invalid Data');
  } catch(e) { window.showToast('فشل جلب الأسعار، حدثها يدوياً.', 'error'); } finally { btn.innerHTML = origText; btn.disabled = false; }
};

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
      if (o.finalPriceEGP) totalRevenueEGP += Number(o.finalPriceEGP);
      else { let price = Number(o.finalPrice || 0); let currency = o.currency || 'EGP'; let rate = currency === 'EGP' ? 1 : (window.storeState.rates[currency] || 1); totalRevenueEGP += (price * rate); }
    } 
  });
  statsGrid.innerHTML = `
    <div style="background:#0b0b12; padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:18px; font-weight:bold; color:var(--accent-neon);">${totalOrders}</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">إجمالي الطلبات</div></div>
    <div style="background:#0b0b12; padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:18px; font-weight:bold; color:#ffcc00;">${pendingOrders}</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">طلبات معلقة ⏳</div></div>
    <div style="background:#0b0b12; padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:18px; font-weight:bold; color:var(--success);">${completedOrders}</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">مكتملة ✅</div></div>
    <div style="background:#0b0b12; padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:16px; font-weight:bold; color:var(--accent-neon);">${totalRevenueEGP.toFixed(0)} EGP</div><div style="font-size:11px; color:var(--text-muted); margin-top:4px;">(≈ إجمالي المبيعات)</div></div>
  `;
};

window.renderAdminOrders = () => {
  const pendingList = document.getElementById('adminOrdersPending'), archivedList = document.getElementById('adminOrdersArchived');
  const searchInput = document.getElementById('adminOrderSearch');
  if (!pendingList || !archivedList) return; pendingList.replaceChildren(); archivedList.replaceChildren();
  
  const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const orders = window.storeState.orders || [];
  
  const filteredOrders = orders.filter(o => {
      if (!searchVal) return true;
      const matchName = String(o.productName || '').toLowerCase().includes(searchVal);
      const matchEmail = String(o.userEmail || '').toLowerCase().includes(searchVal);
      const matchTx = String(o.transactionId || '').toLowerCase().includes(searchVal);
      const matchSender = String(o.senderInfo || '').toLowerCase().includes(searchVal);
      return matchName || matchEmail || matchTx || matchSender;
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending'), archivedOrders = filteredOrders.filter(o => o.status !== 'pending');
  if (!pendingOrders.length) pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">لا توجد طلبات مطابقة.</p>';
  if (!archivedOrders.length) archivedList.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">الأرشيف فارغ.</p>';

  const createOrderHTML = (o, isArchived) => {
    const safeProductName = window.sanitizeText(o.productName); const safeEmail = window.sanitizeText(o.userEmail);
    const safeSender = window.sanitizeText(o.senderInfo); const safeTxId = window.sanitizeText(o.transactionId || 'غير مسجل');
    const safeCustomerData = window.sanitizeText(o.customerData); const safePaymentMethod = window.sanitizeText(o.paymentMethod || 'EGP');
    const discountBadge = o.discountApplied > 0 ? `<span style="color:var(--success); font-weight:bold;">[خصم ${o.discountApplied}%]</span>` : '';
    const receiptView = o.receiptImage ? `<div style="margin-top:8px;"><a href="${window.sanitizeText(o.receiptImage)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-neon); text-decoration:underline;">📄 عرض الإيصال</a></div>` : '';
    const deleteBtn = isArchived ? `<button onclick="window.deleteAdminOrder('${o.id}')" style="position:absolute; bottom:10px; left:10px; background:rgba(255,68,68,0.2); color:var(--danger); border:1px solid var(--danger); padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">حذف نهائي 🗑️</button>` : '';

    let html = `<div class="admin-item-row" style="flex-direction:column; align-items:flex-start; position:relative; padding-bottom: ${isArchived ? '35px' : '10px'}"><span style="position:absolute; top:10px; left:10px; font-size:11px; color:var(--text-muted);">${window.formatDate(o.createdAt)}</span><div style="width:100%; margin-bottom:8px; line-height:1.6; padding-left: 100px;"><strong>الطلب:</strong> <span style="color:var(--accent-neon);">${safeProductName}</span> | <strong>الإيميل:</strong> ${safeEmail}<br><small><strong>السعر:</strong> <span style="color:var(--accent-neon);">${o.finalPrice} ${o.currency || 'EGP'}</span> ${o.finalPriceEGP ? `(≈ ${o.finalPriceEGP} EGP)` : ''} ${discountBadge}</small><br><small><strong>طريقة الدفع:</strong> ${safePaymentMethod} | <strong>محول من:</strong> ${safeSender} | <strong style="color:var(--accent-neon);">رقم العملية:</strong> ${safeTxId}<br><strong style="color:var(--accent-neon);">بيانات الاستلام:</strong> ${safeCustomerData} <button onclick="window.copyCustomerData('${safeCustomerData}')" style="background:var(--accent-neon); color:#000; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">نسخ</button></small><br>${receiptView}<small style="display:block; margin-top:5px;"><strong>الحالة:</strong> <span style="color:${o.status==='completed'?'var(--success)':o.status==='cancelled'?'var(--danger)':'#ffcc00'}">${o.status}</span></small>${isArchived && o.deliveredCode ? `<small style="display:block; color:var(--success);"><strong>الكود المُسلم:</strong> ${window.sanitizeText(o.deliveredCode, 2000)}</small>` : ''}</div>${deleteBtn}`;
    if (!isArchived) html += `<div style="display:flex; gap:8px; width:100%; flex-wrap:wrap; margin-top:5px; border-top:1px dashed var(--border-color); padding-top:10px;"><input type="text" id="code_${o.id}" placeholder="اكتب كود التفعيل هنا..." value="${window.sanitizeText(o.deliveredCode || '', 1000)}" style="flex:1; padding:8px; border-radius:5px; background:#0b0b12; color:#fff; border:1px solid var(--border-color);"><button class="submit-btn" style="padding:8px 12px; flex:0;" onclick="window.updateOrderStatus('${o.id}', 'completed')">إكمال ✅</button><button class="cancel-btn" style="padding:8px 12px; flex:0; border-color:var(--danger); color:var(--danger);" onclick="window.updateOrderStatus('${o.id}', 'cancelled')">إلغاء ❌</button></div>`;
    html += `</div>`; return html;
  };
  pendingOrders.forEach(o => pendingList.insertAdjacentHTML('beforeend', createOrderHTML(o, false)));
  archivedOrders.forEach(o => archivedList.insertAdjacentHTML('beforeend', createOrderHTML(o, true)));
  if(orders.length >= window.adminOrdersLimit && !searchVal) archivedList.insertAdjacentHTML('beforeend', `<button type="button" class="load-more-btn" style="width:100%; padding:10px; background:transparent; color:var(--accent-neon); border:1px dashed var(--accent-neon); cursor:pointer;" onclick="window.loadMoreAdminOrders()">عرض المزيد ⬇️</button>`);
};

// 🛡️ دالة استرجاع المخزون عند إلغاء أو حذف الطلب مع إعادة تفعيل الحقل inStock بدقة
window.refundOrderStock = async (order) => {
    if (!order) return;
    let itemsToRefund = [];
    if (order.items && Array.isArray(order.items)) itemsToRefund = order.items;
    else if (order.productIds) itemsToRefund = order.productIds.map(pid => ({ id: pid, title: order.productName || 'منتج' }));
    if (itemsToRefund.length === 0) return;

    const grouped = itemsToRefund.reduce((acc, item) => {
        const key = `${item.id}_${item.variantId || 'none'}`;
        if (!acc[key]) acc[key] = { id: item.id, variantId: item.variantId, qty: 0, title: item.title || order.productName };
        acc[key].qty += 1; return acc;
    }, {});

    for (const key in grouped) {
        const { id, variantId, qty } = grouped[key];
        const prod = window.storeState.products.find(p => p.id === id);
        if (prod) {
            if (variantId && prod.variants) {
                const vIndex = prod.variants.findIndex(v => (v.id || v.nameEn) === variantId);
                if (vIndex !== -1) {
                    if (prod.variants[vIndex].stockQuantity !== undefined && prod.variants[vIndex].stockQuantity !== null) {
                        prod.variants[vIndex].stockQuantity += qty; 
                    }
                    const anyVarAvailable = prod.variants.some(v => v.stockQuantity === null || v.stockQuantity === undefined || v.stockQuantity > 0);
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { 
                        variants: prod.variants,
                        inStock: anyVarAvailable
                    });
                }
            } else if (prod.stockQuantity !== undefined && prod.stockQuantity !== null) {
                const newStock = prod.stockQuantity + qty;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { 
                    stockQuantity: newStock, 
                    inStock: newStock > 0 
                });
            } else if (prod.stockQuantity === null || prod.stockQuantity === undefined) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), { 
                    inStock: true 
                });
            }
        }
    }
};

window.deleteAdminOrder = async (orderId) => { 
  if (!window.checkIsAdmin() || !confirm('تأكيد الحذف النهائي؟')) return window.showToast('غير مصرح!', 'error'); 
  try { 
    const order = window.storeState.orders.find(o => o.id === orderId);
    if (order && order.status !== 'cancelled') await window.refundOrderStock(order);
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId)); window.showToast('🗑️ تم الحذف', 'success'); 
  } catch(e) { window.showToast('فشل الحذف', 'error'); } 
};

window.updateOrderStatus = async (orderId, status) => {
  if (!window.checkIsAdmin()) return window.showToast('غير مصرح لك بتنفيذ هذا الإجراء!', 'error');
  const codeInput = document.getElementById(`code_${orderId}`); if(!codeInput) return;
  try {
    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
    let codeToDeliver = codeInput.value.trim();
    const order = window.storeState.orders.find(o => o.id === orderId);

    if (status === 'cancelled') {
        if (order && order.status !== 'cancelled') {
            await window.refundOrderStock(order);
        }
        await updateDoc(orderRef, { status, deliveredCode: codeToDeliver, updatedAt: serverTimestamp() });
        window.showToast('تم التحديث والإلغاء واسترجاع المخزون!', 'success');
    } else if (status === 'completed' && order) {

        let multiCodesArr = [];
        let itemsList = order.items ? order.items : (order.productIds ? order.productIds.map(id => ({ id })) : []);

        const groupedItems = itemsList.reduce((acc, item) => {
            const key = `${item.id}_${item.variantId || 'main'}`;
            if(!acc[key]) acc[key] = { id: item.id, variantId: item.variantId, qty: 0, title: item.title || order.productName };
            acc[key].qty += 1;
            return acc;
        }, {});

        await runTransaction(db, async (transaction) => {
            if (!codeToDeliver && itemsList.length > 0) {
                const uniquePids = [...new Set(itemsList.map(i => i.id))];
                const vaultSnapshots = {};
                for (const pid of uniquePids) {
                    const vaultRef = doc(db, 'artifacts', appId, 'public', 'data', 'vault', pid);
                    vaultSnapshots[pid] = { ref: vaultRef, snap: await transaction.get(vaultRef) };
                }

                for (const key of Object.keys(groupedItems)) {
                    const req = groupedItems[key];
                    const vaultInfo = vaultSnapshots[req.id];
                    if (!vaultInfo || !vaultInfo.snap.exists()) continue;

                    const vData = vaultInfo.snap.data();
                    let targetCodesStr = ""; let isVariant = false; let vIdKey = "";

                    if (req.variantId && vData.variantsVaultCodes && vData.variantsVaultCodes[req.variantId]) {
                        targetCodesStr = vData.variantsVaultCodes[req.variantId];
                        isVariant = true; vIdKey = req.variantId;
                    } else {
                        targetCodesStr = vData.generalVaultCodes || "";
                    }

                    if (targetCodesStr) {
                        let codes = targetCodesStr.split('\n').map(c => c.trim()).filter(c => c);
                        let extractedQty = Math.min(req.qty, codes.length);
                        for(let i=0; i<extractedQty; i++){
                            let extractedCode = codes.shift();
                            multiCodesArr.push(`${req.title}: ${extractedCode}`);
                        }
                        if (isVariant) {
                            vData.variantsVaultCodes[vIdKey] = codes.join('\n');
                            transaction.update(vaultInfo.ref, { variantsVaultCodes: vData.variantsVaultCodes });
                        } else {
                            transaction.update(vaultInfo.ref, { generalVaultCodes: codes.join('\n') });
                        }
                    }
                }
                if (multiCodesArr.length > 0) codeToDeliver = multiCodesArr.join(' || ');
            }
            transaction.update(orderRef, { status, deliveredCode: codeToDeliver, updatedAt: serverTimestamp() });
        });
        window.showToast('تم التحديث وتسليم الكود!', 'success');
    }
  } catch(e) { console.error(e); window.showToast('خطأ في التحديث', 'error'); }
};

window.removeGalleryImage = (idx) => {
    window.tempGalleryUrls.splice(idx, 1);
    window.renderGalleryPreview(window.tempGalleryUrls);
};

window.renderGalleryPreview = (urls) => {
    const box = document.getElementById('previewGallery'); if(!box) return;
    box.innerHTML = urls.map((url, i) => `<div class="gallery-preview-item"><img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;"><button class="delete-img-btn" onclick="window.removeGalleryImage(${i})">✕</button></div>`).join('');
};

window.saveProduct = async () => {
  if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error');
  const isActive = document.getElementById('newProdActive').checked, isFeatured = document.getElementById('newProdFeatured').checked, requireData = document.getElementById('newProdRequireData').checked;
  const titleAr = document.getElementById('newProdTitleAr').value.trim(), titleEn = document.getElementById('newProdTitleEn').value.trim();
  const category = document.getElementById('newProdCat').value || 'games', platform = document.getElementById('newProdPlatform').value || '';
  const tags = document.getElementById('newProdTags').value.split(',').map(t => t.trim()).filter(t => t);
  let price = Number(document.getElementById('newProdPrice').value) || 0; const oldPrice = Number(document.getElementById('newProdOldPrice').value) || 0;
  
  // 🛡️ [إصلاح الكمية]: إرسال null عند ترك الخانة فارغة لتعود "غير محدودة" بشكل متوافق مع Firebase
  const stockInputVal = document.getElementById('newProdStock').value;
  const stockQuantity = stockInputVal !== '' ? Number(stockInputVal) : null;

  let deliveryTime = document.getElementById('newProdDeliveryTime').value;
  const externalLink = document.getElementById('newProdExternalLink').value.trim();
  const generalVaultCodes = document.getElementById('newProdVault').value || '';
  
  const bundleProductId = document.getElementById('newProdBundleId').value.trim();
  const bundleDiscount = Number(document.getElementById('newProdBundleDiscount').value) || 0;

  let qiAccount = document.getElementById('qiAccountCustom').value, qiWarranty = document.getElementById('qiWarrantyCustom').value, qiRegion = document.getElementById('qiRegionCustom').value;
  const quickInfo = { accountAr: qiAccount.split('|')[0]?.trim() || '', accountEn: qiAccount.split('|')[1]?.trim() || qiAccount, warrantyAr: qiWarranty.split('|')[0]?.trim() || '', warrantyEn: qiWarranty.split('|')[1]?.trim() || qiWarranty, regionAr: qiRegion.split('|')[0]?.trim() || '', regionEn: qiRegion.split('|')[1]?.trim() || qiRegion };
  const trailerUrl = document.getElementById('newProdTrailer').value.trim();
  const descAr = document.getElementById('newProdDescAr').value, descEn = document.getElementById('newProdDescEn').value;
  const reqAr = document.getElementById('newProdReqAr').value, reqEn = document.getElementById('newProdReqEn').value;
  const faqText = document.getElementById('newProdFaq').value, badgeAr = document.getElementById('newProdBadgeAr').value, badgeEn = document.getElementById('newProdBadgeEn').value;
  const crossSellIds = document.getElementById('newProdCrossSell').value.split(',').map(id => id.trim()).filter(id => id);

  const variants = [];
  const variantsVaultMap = {};
  document.querySelectorAll('#variantsList .variant-row').forEach(row => {
    const vId = row.dataset.variantId || `v_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const nameAr = row.querySelector('.var-ar').value.trim(), nameEn = row.querySelector('.var-en').value.trim();
    const vPrice = Number(row.querySelector('.var-price').value), vOld = Number(row.querySelector('.var-old').value) || 0;
    const vStock = row.querySelector('.var-stock').value, vVault = row.querySelector('.var-vault').value;
    if(nameAr && vPrice > 0) {
        variants.push({ id: vId, nameAr, nameEn, price: vPrice, oldPrice: vOld, stockQuantity: vStock !== '' ? Number(vStock) : null });
        if (vVault) variantsVaultMap[vId] = vVault;
    }
  });
  if (variants.length > 0) { price = Math.min(...variants.map(v => v.price)); }
  if (!titleAr || price <= 0) return window.showToast('تأكد من الاسم والسعر!', 'error');

  const btn = document.getElementById('saveProductBtn'); const origText = btn.textContent; btn.textContent = 'جاري الرفع والحفظ ⏳...'; btn.disabled = true;

  try {
    const targetProductId = window.editingProductId || Date.now().toString();
    const oldP = window.editingProductId ? window.storeState.products.find(p => p.id === window.editingProductId) : null;
    let imgUrl = oldP ? oldP.imgUrl : ''; let bannerUrl = oldP ? oldP.bannerUrl : ''; let gallery = window.tempGalleryUrls || [];
    const coverInput = document.getElementById('newProdImgFileInput'); if (coverInput && coverInput.files[0]) imgUrl = await window.uploadImageToImgBB(coverInput.files[0]) || imgUrl;
    const bannerInput = document.getElementById('newProdBannerFileInput'); if (bannerInput && bannerInput.files[0]) bannerUrl = await window.uploadImageToImgBB(bannerInput.files[0]) || bannerUrl;
    const galleryInput = document.getElementById('newProdGallery');
    if (galleryInput && galleryInput.files.length > 0) { for (let i = 0; i < galleryInput.files.length; i++) { const url = await window.uploadImageToImgBB(galleryInput.files[i]); if (url) gallery.push(url); } }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vault', targetProductId), {
        generalVaultCodes: generalVaultCodes,
        variantsVaultCodes: variantsVaultMap
    });

    let computedInStock = true;
    if (variants.length > 0) {
        computedInStock = variants.some(v => v.stockQuantity === null || v.stockQuantity === undefined || v.stockQuantity > 0);
    } else if (stockQuantity !== null) {
        computedInStock = stockQuantity > 0;
    }

    const prodData = { isActive, isFeatured, requireData, titleAr, titleEn, category, platform, tags, price, oldPrice, inStock: computedInStock, stockQuantity, deliveryTime, externalLink, bundleProductId, bundleDiscount, quickInfo, trailerUrl, imgUrl, bannerUrl, gallery, descAr, descEn, reqAr, reqEn, faqText, badgeAr, badgeEn, crossSellIds, variants };

    if (window.editingProductId) { 
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', window.editingProductId), prodData); 
        window.showToast('✏️ تم التعديل!', 'success'); 
    } else { 
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', targetProductId), prodData); 
        window.showToast('📦 تمت الإضافة بنجاح!', 'success'); 
    }
    window.cancelEdit();
  } catch (e) { console.error(e); window.showToast('فشل العملية', 'error'); } finally { btn.textContent = origText; btn.disabled = false; }
};

window.editProduct = async (id) => {
  const p = window.storeState.products.find(x => x.id === id); if(!p) return;
  document.getElementById('newProdActive').checked = p.isActive !== false; document.getElementById('newProdFeatured').checked = p.isFeatured === true; document.getElementById('newProdRequireData').checked = p.requireData !== false;
  const setVal = (elmId, val) => { const el = document.getElementById(elmId); if (el) el.value = val ?? ''; };
  setVal('newProdTitleAr', p.titleAr || p.title); setVal('newProdTitleEn', p.titleEn || p.title);
  setVal('newProdCat', p.category || 'games'); setVal('newProdPlatform', p.platform); setVal('newProdTags', p.tags ? p.tags.join(', ') : '');
  setVal('newProdPrice', p.price); setVal('newProdOldPrice', p.oldPrice); setVal('newProdStock', p.stockQuantity !== undefined && p.stockQuantity !== null ? p.stockQuantity : '');
  setVal('newProdExternalLink', p.externalLink); setVal('newProdTrailer', p.trailerUrl);
  setVal('newProdBundleId', p.bundleProductId); setVal('newProdBundleDiscount', p.bundleDiscount);
  setVal('newProdDescAr', p.descAr); setVal('newProdDescEn', p.descEn); setVal('newProdReqAr', p.reqAr); setVal('newProdReqEn', p.reqEn);
  setVal('newProdFaq', p.faqText); setVal('newProdBadgeAr', p.badgeAr); setVal('newProdBadgeEn', p.badgeEn); setVal('newProdCrossSell', p.crossSellIds ? p.crossSellIds.join(', ') : '');

  try {
      const vaultSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vault', id));
      if (vaultSnap.exists()) {
          const vData = vaultSnap.data();
          setVal('newProdVault', vData.generalVaultCodes || '');
          if (p.variants) {
              p.variants.forEach(v => {
                  if (vData.variantsVaultCodes && vData.variantsVaultCodes[v.id]) {
                      v.vaultCodes = vData.variantsVaultCodes[v.id];
                  }
              });
          }
      }
  } catch(e) {}

  const handleDropdownCustom = (selectId, inputId, val) => {
      const selectEl = document.getElementById(selectId);
      const inputEl = document.getElementById(inputId);
      if(!selectEl || !inputEl) return;
      let matched = false;
      for(let opt of selectEl.options) {
          if(opt.value === val) { selectEl.value = val; inputEl.style.display = 'none'; matched = true; break; }
      }
      if(!matched && val) { selectEl.value = 'other'; inputEl.style.display = 'block'; inputEl.value = val; }
  };

  if(p.deliveryTime) {
      handleDropdownCustom('newProdDeliverySelect', 'newProdDeliveryTime', p.deliveryTime);
  }
  if(p.quickInfo) {
      handleDropdownCustom('qiAccountSelect', 'qiAccountCustom', (p.quickInfo.accountAr || '') + (p.quickInfo.accountEn ? ' | ' + p.quickInfo.accountEn : ''));
      handleDropdownCustom('qiWarrantySelect', 'qiWarrantyCustom', (p.quickInfo.warrantyAr || '') + (p.quickInfo.warrantyEn ? ' | ' + p.quickInfo.warrantyEn : ''));
      handleDropdownCustom('qiRegionSelect', 'qiRegionCustom', (p.quickInfo.regionAr || '') + (p.quickInfo.regionEn ? ' | ' + p.quickInfo.regionEn : ''));
  }
  
  const list = document.getElementById('variantsList'); if (list) { list.replaceChildren(); if (p.variants) p.variants.forEach(v => window.addVariantInput(v)); }
  const coverBox = document.getElementById('previewCover'); if (coverBox && p.imgUrl) coverBox.innerHTML = `<img src="${p.imgUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
  const bannerBox = document.getElementById('previewBanner'); if (bannerBox && p.bannerUrl) bannerBox.innerHTML = `<img src="${p.bannerUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
  window.tempGalleryUrls = p.gallery ? [...p.gallery] : []; window.renderGalleryPreview(window.tempGalleryUrls);
  window.editingProductId = id; document.getElementById('saveProductBtn').innerHTML = '💾 حفظ التعديلات'; document.getElementById('cancelEditBtn').style.display = 'block'; document.getElementById('productFormSection').scrollIntoView({behavior: 'smooth'});
};

window.cancelEdit = () => {
  window.editingProductId = null; window.tempGalleryUrls = [];
  document.getElementById('saveProductBtn').innerHTML = '➕ إضافة المنتج ونشره'; document.getElementById('cancelEditBtn').style.display = 'none';
  document.querySelectorAll('#productFormSection input[type="text"], #productFormSection input[type="number"], #productFormSection textarea, #productFormSection select').forEach(el => { if(el.id !== 'newProdCat' && el.id !== 'newProdPlatform') el.value = ''; });
  document.querySelectorAll('#productFormSection input[type="checkbox"]').forEach(el => el.checked = true); document.getElementById('newProdFeatured').checked = false;
  document.getElementById('variantsList').replaceChildren(); document.getElementById('previewCover').innerHTML = '<span>معاينة الغلاف</span>'; document.getElementById('previewBanner').innerHTML = '<span>معاينة البانر</span>'; document.getElementById('previewGallery').innerHTML = '';
};

window.renderAdminProducts = () => {
  const list = document.getElementById('adminProductsList'); 
  const searchInput = document.getElementById('adminProductSearch');
  if (!list) return; list.replaceChildren();
  
  const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const products = window.storeState.products || [];

  const filteredProds = products.filter(p => {
      if(!searchVal) return true;
      const title = String(p.titleAr || p.title || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      return title.includes(searchVal) || id.includes(searchVal);
  });

  if (!filteredProds.length) {
      list.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:15px;">لا توجد منتجات مطابقة للبحث.</p>';
      return;
  }

  filteredProds.forEach(p => {
    let statusText = p.isActive === false ? '<span style="color:var(--text-muted);">[مخفي]</span>' : '<span style="color:var(--success);">[مفعل]</span>';
    let featuredText = p.isFeatured ? '<span style="color:var(--accent-neon);">⭐ تثبيت</span>' : '';
    let stockText = (p.variants && p.variants.length > 0) ? (p.variants.some(v => v.stockQuantity === undefined || v.stockQuantity === null || v.stockQuantity > 0) ? `متاح (باقات)` : 'باقات نفذت') : (p.inStock && (p.stockQuantity === undefined || p.stockQuantity === null || p.stockQuantity > 0) ? `متاح (${p.stockQuantity !== undefined && p.stockQuantity !== null ? p.stockQuantity : '∞'})` : 'نفذت الكمية');
    const title = p.titleAr || p.title || '';
    
    list.insertAdjacentHTML('beforeend', `<div class="admin-item-row"><span style="flex:1; line-height:1.6;">${statusText} ${featuredText} <strong>${window.sanitizeText(title)}</strong> <small style="color:var(--accent-neon); font-family:monospace;">(ID: ${p.id})</small> <button type="button" onclick="navigator.clipboard.writeText('${p.id}').then(()=>window.showToast('تم نسخ الـ ID بنجاح 📋','success'))" style="background:var(--card-bg); color:var(--accent-neon); border:1px solid var(--border-color); padding:2px 8px; border-radius:4px; font-size:11px; cursor:pointer; margin-inline-start:5px;">نسخ ID 📋</button> - ${p.price} EGP <br><small><strong>المخزون:</strong> ${stockText}</small></span><div style="display:flex; gap:8px;"><button class="submit-btn" style="padding:6px 12px; font-size:12px; flex:0;" onclick="window.editProduct('${p.id}')">تعديل</button><button class="delete-btn" onclick="window.deleteProduct('${p.id}')">حذف</button></div></div>`);
  });
};

window.deleteProduct = async (id) => { if (!window.checkIsAdmin() || !confirm('تأكيد الحذف؟')) return window.showToast('غير مصرح', 'error'); try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vault', id)); window.showToast('تم الحذف', 'success'); } catch (e) { window.showToast('فشل الحذف', 'error'); } };

window.addSlide = async () => { 
  if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error');
  const title = document.getElementById('slideTitleInput').value.trim(), desc = document.getElementById('slideDescInput').value.trim(), link = document.getElementById('slideLinkInput').value.trim(), fileInput = document.getElementById('slideImgFileInput');
  if (!title || !fileInput || !fileInput.files[0]) return window.showToast('أدخل العنوان واختار صورة!', 'error');
  if ((window.storeState.slides ? window.storeState.slides.length : 0) >= 6) return window.showToast('أقصى حد 6 صور!', 'error');
  const btn = document.getElementById('saveSlideBtn'); const origText = btn.textContent; btn.textContent = 'جاري الإضافة ⏳...'; btn.disabled = true;
  try { const imgUrl = await window.uploadImageToImgBB(fileInput.files[0]); if (!imgUrl) throw new Error("فشل الرفع"); const slides = window.storeState.slides ? [...window.storeState.slides] : []; slides.push({ title, desc, link, imgUrl }); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true }); window.showToast('تمت الإضافة!', 'success'); document.getElementById('slideTitleInput').value = ''; document.getElementById('slideDescInput').value = ''; document.getElementById('slideLinkInput').value = ''; document.getElementById('slideImgFileInput').value = ''; window.storeState.slides = slides; window.renderAdminSlides(); window.renderPromoSlider(); } catch(e) { window.showToast('فشل الإضافة', 'error'); } finally { btn.textContent = origText; btn.disabled = false; }
};

window.deleteSlide = async (idx) => { if (!window.checkIsAdmin()) return; try { const slides = [...window.storeState.slides]; slides.splice(idx, 1); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { slides }, { merge: true }); window.storeState.slides = slides; window.renderAdminSlides(); window.renderPromoSlider(); window.showToast('تم الحذف', 'success'); } catch(e) {} };

window.renderAdminSlides = () => { const list = document.getElementById('adminSlidesList'); if(list) { if (!window.storeState.slides || window.storeState.slides.length === 0) { list.innerHTML = '<div style="background: rgba(255,204,0,0.1); border: 1px solid #ffcc00; padding: 15px; border-radius: 8px; color: #ffcc00; text-align: center; font-size: 13px; margin-top:15px;">⚠️ السلايدر فارغ!</div>'; } else { list.innerHTML = window.storeState.slides.map((s,i) => `<div class="admin-item-row"><span style="flex:1;"><strong>${window.sanitizeText(s.title)}</strong><br><small style="color:var(--accent-neon);">${s.link ? '🔗 ' + window.sanitizeText(s.link) : 'بدون توجيه'}</small></span><button class="delete-btn" onclick="window.deleteSlide(${i})">حذف 🗑️</button></div>`).join(''); } } };

window.saveGeneralSettings = async () => { if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error'); try { const rates = { SAR: Number(document.getElementById('admRateSAR').value), AED: Number(document.getElementById('admRateAED').value), USD: Number(document.getElementById('admRateUSD').value) }; const payments = { instapay: document.getElementById('admInstapay').value, vodafone: document.getElementById('admVodafone').value, orange: document.getElementById('admOrange').value, cryptoTRC20: document.getElementById('admCryptoTRC20').value, cryptoBEP20: document.getElementById('admCryptoBEP20').value }; const whatsapp = document.getElementById('admWhatsapp').value; const promos = []; document.querySelectorAll('#promosList .promo-row').forEach(row => { const code = row.querySelector('.promo-code').value.trim(); const discount = Number(row.querySelector('.promo-disc').value); const expiry = row.querySelector('.promo-exp').value; const productId = row.querySelector('.promo-prod').value.trim(); if(code && discount > 0) promos.push({ code, discount, expiry, productId }); }); const bannerAr = document.getElementById('admBannerAr').value; const bannerExpiry = document.getElementById('admBannerExpiry').value; await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { rates, payments, promos, whatsapp, bannerAr, bannerExpiry }, { merge: true }); window.showToast('تم حفظ الإعدادات!', 'success'); } catch(e) { window.showToast('خطأ في الحفظ', 'error'); } };

window.saveSeoSettings = async () => { if (!window.checkIsAdmin()) return window.showToast('غير مصرح!', 'error'); try { const seo = { title: document.getElementById('seoTitle').value.trim(), desc: document.getElementById('seoDesc').value.trim(), keywords: document.getElementById('seoKeywords').value.trim() }; await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), { seo }, { merge: true }); window.showToast('✅ تم حفظ السيو!', 'success'); if(seo.title) { document.getElementById('metaTitle').textContent = seo.title; document.getElementById('metaOgTitle').content = seo.title; } if(seo.desc) { document.getElementById('metaDesc').content = seo.desc; document.getElementById('metaOgDesc').content = seo.desc; } if(seo.keywords) document.getElementById('metaKeywords').content = seo.keywords; } catch (e) { window.showToast('خطأ في الحفظ', 'error'); } };
