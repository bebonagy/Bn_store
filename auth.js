// auth.js
import { auth, db, appId, ADMIN_UID, googleProvider } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, signInWithRedirect, sendPasswordResetEmail, getRedirectResult } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let currentUserProfile = null;
export const checkIsAdmin = () => Boolean(auth.currentUser && auth.currentUser.uid === ADMIN_UID);
let tempRegistrationData = null;

export const initAuth = (translations, currentLang, onUserChangeCallback) => {
  // 1. استقبال الرد بعد الدخول بجوجل
  setTimeout(async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid), { 
          uid: result.user.uid, 
          name: result.user.displayName || 'مستخدم جوجل', 
          email: result.user.email, 
          createdAt: serverTimestamp() 
        }, { merge: true });
        if(window.showToast) window.showToast('🎉 تم تسجيل الدخول بواسطة Google بنجاح!', 'success');
      }
    } catch (error) {
      console.error("Redirect Error:", error);
    }
  }, 1000);

  // 2. مستمع حالة تسجيل الدخول
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUserProfile = { uid: user.uid, email: user.email, name: user.displayName || 'مستخدم' };
      onUserChangeCallback(user, currentUserProfile);
    } else {
      currentUserProfile = null;
      onUserChangeCallback(null, null);
    }
  });

  // 3. أحداث واجهة تسجيل الدخول
  const authModal = document.getElementById('authModal');
  
  document.getElementById('loginBtnNav')?.addEventListener('click', () => { 
      if (currentUserProfile) {
          document.getElementById('userAccountModal').style.display = 'flex'; 
      } else {
          authModal.style.display = 'flex'; 
      }
  });

  document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) return window.showToast('أدخل البريد وكلمة المرور!', 'error');
    try { await signInWithEmailAndPassword(auth, email, pass); authModal.style.display = 'none'; window.showToast('تم تسجيل الدخول بنجاح!', 'success'); } catch (e) { window.showToast('البيانات غير صحيحة!', 'error'); }
  });

  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e) { 
      window.showToast('فشل تسجيل الدخول: ' + (e.message || e.code), 'error'); 
    }
  });

  // 4. استعادة كلمة المرور
  document.getElementById('resetPassBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('authViewLogin').style.display = 'none';
    document.getElementById('authViewRegister').style.display = 'none';
    document.getElementById('authViewReset').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'استعادة كلمة المرور | BN MAX';
  });

  document.getElementById('backToLoginFromReset')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('authViewReset').style.display = 'none';
    document.getElementById('authViewLogin').style.display = 'block';
    document.getElementById('authModalTitle').textContent = translations[currentLang].auth_title;
  });

  document.getElementById('doSendResetBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmailInput').value.trim();
    if (!email) return window.showToast('أدخل البريد الإلكتروني أولاً!', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      window.showToast('✉️ تم إرسال رابط استعادة كلمة المرور بنجاح!', 'success');
      document.getElementById('authViewReset').style.display = 'none';
      document.getElementById('authViewLogin').style.display = 'block';
      document.getElementById('authModalTitle').textContent = translations[currentLang].auth_title;
    } catch(err) { window.showToast('حدث خطأ، تأكد من صحة البريد.', 'error'); }
  });

  // 5. التنقل بين التسجيل والدخول
  document.getElementById('showRegisterBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'none'; document.getElementById('authViewRegister').style.display = 'block'; document.getElementById('authModalTitle').textContent = translations[currentLang].create_account; });
  document.getElementById('showLoginBtn')?.addEventListener('click', () => { document.getElementById('authViewLogin').style.display = 'block'; document.getElementById('authViewRegister').style.display = 'none'; document.getElementById('authViewOTP').style.display = 'none'; document.getElementById('authModalTitle').textContent = translations[currentLang].btn_login; });
  document.getElementById('backToRegFromOTP')?.addEventListener('click', () => { document.getElementById('authViewOTP').style.display = 'none'; document.getElementById('authViewRegister').style.display = 'block'; });

  // 6. نظام التسجيل والـ OTP
  document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim(), email = document.getElementById('regEmail').value.trim(), pass = document.getElementById('regPass').value;
    if (!name || !email || !pass) return window.showToast('أكمل جميع البيانات!', 'error');
    if (pass !== document.getElementById('regPassConfirm').value) return window.showToast('كلمة المرور غير متطابقة!', 'error');
    
    const btn = document.getElementById('doRegisterBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإرسال ⏳...'; btn.disabled = true;
    
    try {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        tempRegistrationData = { name, email, pass, otp: otpCode };
        
        if (typeof emailjs !== 'undefined') {
            const customMessage = `كود التفعيل الخاص بك هو:<div class="otp-box">${otpCode}</div>لا تشارك هذا الكود مع أحد.`;
            await emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: name, to_email: email, custom_message: customMessage });
        }
        document.getElementById('authViewRegister').style.display = 'none';
        document.getElementById('authViewOTP').style.display = 'block';
        window.showToast('✉️ تم إرسال كود التفعيل إلى بريدك!', 'success');
    } catch(e) {
        window.showToast('حدث خطأ أثناء إرسال الكود، حاول مرة أخرى.', 'error');
    } finally {
        btn.textContent = origText; btn.disabled = false;
    }
  });

  document.getElementById('doVerifyOTPBtn')?.addEventListener('click', async () => {
    const inputOTP = document.getElementById('regOTP').value.trim();
    if (!inputOTP) return window.showToast('أدخل كود التفعيل!', 'error');
    if (!tempRegistrationData || inputOTP !== tempRegistrationData.otp) return window.showToast('❌ الكود غير صحيح!', 'error');

    const btn = document.getElementById('doVerifyOTPBtn'); const origText = btn.textContent;
    btn.textContent = 'جاري الإنشاء ⏳...'; btn.disabled = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.pass); 
      await updateProfile(cred.user, { displayName: tempRegistrationData.name });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { uid: cred.user.uid, name: tempRegistrationData.name, email: tempRegistrationData.email, createdAt: serverTimestamp() });
      
      document.getElementById('authModal').style.display = 'none'; window.showToast('🎉 تم إنشاء الحساب وتفعيله بنجاح!', 'success');
      
      if (typeof emailjs !== 'undefined') {
        const welcomeMessage = `حسابك دلوقتي جاهز ومفعل بنجاح.<br>تقدر تتصفح أحدث العروض، وتضيف منتجاتك المفضلة، وتتابع طلباتك بكل سهولة وأمان.<br><br><div class="btn-container"><a href="https://bn-max.com" class="btn">تصفح العروض الآن 🚀</a></div>`;
        emailjs.send("service_01wl99f", "template_gx1ra8k", { to_name: tempRegistrationData.name, to_email: tempRegistrationData.email, custom_message: welcomeMessage }).catch(err => console.log("Welcome Email Error"));
      }
      tempRegistrationData = null; document.getElementById('regOTP').value = '';
    } catch (e) { window.showToast('خطأ! ربما البريد مستخدم مسبقاً.', 'error'); } 
    finally { btn.textContent = origText; btn.disabled = false; }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => { 
    try { 
      await signOut(auth); 
      document.getElementById('userAccountModal').style.display = 'none'; 
      window.showToast('تم تسجيل الخروج!', 'success'); 
    } catch (e) {} 
  });
};
