import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

export const $ = (selector, root=document) => root.querySelector(selector);
export const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
export function message(el, text, kind='') {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
}
export function friendlyError(error) {
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account was found for that email. Create an account or try another email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorised in Firebase Authentication settings.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console.',
    'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    'auth/email-already-in-use': 'That email already has an account. Please sign in.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'permission-denied': 'Firebase rules denied this action. Check Firestore rules.',
    'unavailable': 'Service temporarily unavailable. Check your connection and try again.'
  };
  return map[error?.code] || error?.message || 'Something went wrong. Please try again.';
}
export function requireUser({redirect=true}={}) {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, async user => {
      stop();
      if (!user) { if (redirect) location.replace('./index.html'); resolve(null); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() : {};
        if (profile.active === false) {
          await signOut(auth);
          if (redirect) location.replace('./index.html');
          resolve(null); return;
        }
        const chip = $('#accountChip');
        if (chip) chip.textContent = profile.name || user.displayName || user.email || 'Signed in';
        resolve({user, profile});
      } catch (e) { reject(e); }
    }, reject);
  });
}
export function setupShell() {
  const sidebar=$('#sidebar'), overlay=$('#sidebarOverlay'), menu=$('#menuButton');
  const close=()=>{sidebar?.classList.remove('open');overlay?.classList.remove('show');menu?.setAttribute('aria-expanded','false');};
  menu?.addEventListener('click',()=>{const open=!sidebar?.classList.contains('open');sidebar?.classList.toggle('open',open);overlay?.classList.toggle('show',open);menu?.setAttribute('aria-expanded',String(open));});
  overlay?.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  $$('.sidebar-nav a').forEach(a=>a.addEventListener('click',close));
  const logout=async()=>{try{await signOut(auth);location.replace('./index.html');}catch(e){const chip=$('#accountChip');if(chip)chip.textContent='Sign out failed';console.error(e);}};
  $('#logoutButton')?.addEventListener('click',logout); $('#logoutButtonSettings')?.addEventListener('click',logout);
  if ('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
export async function getApiBase(){
  // Set window.WIFI_HUB_API_BASE in a small config script if your Python function is deployed.
  return (window.WIFI_HUB_API_BASE || '').replace(/\/$/,'');
}
export async function apiRequest(path, options={}) {
  const base=await getApiBase();
  if(!base) throw new Error('Python backend URL is not configured yet.');
  const token=await auth.currentUser?.getIdToken();
  const response=await fetch(`${base}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.message || `Request failed (${response.status}).`);
  return body;
}


// User-friendly preferences: themes, accent, glass opacity, blur, language, back navigation and onboarding.
const PREF_KEY = 'wifiHubPreferencesV1';
const DEFAULT_PREFS = { theme: 'system', accent: '#4285f4', opacity: 82, blur: 18, language: 'en', font: 'system', notifications: false, offlineMode: false };
const THEMES = {
  dark: { bg:'#090910', panel:'rgba(22,22,35,.82)', accent:'#4285f4', strong:'#245fce' },
  system: { bg:'#090910', panel:'rgba(22,22,35,.82)', accent:'#4285f4', strong:'#245fce' },
  violet: { bg:'#090910', panel:'rgba(22,22,35,.82)', accent:'#a78bfa', strong:'#8b5cf6' },
  ocean: { bg:'#07131b', panel:'rgba(17,35,48,.82)', accent:'#67d5e8', strong:'#168aad' },
  emerald: { bg:'#07140f', panel:'rgba(18,39,29,.82)', accent:'#6ee7b7', strong:'#059669' },
  sunset: { bg:'#190d12', panel:'rgba(48,25,34,.82)', accent:'#f9a8d4', strong:'#db2777' },
  amber: { bg:'#171208', panel:'rgba(43,32,15,.82)', accent:'#fcd34d', strong:'#d97706' },
  light: { bg:'#f4f3fa', panel:'rgba(255,255,255,.86)', accent:'#7c3aed', strong:'#6d28d9' }
};
const LANG = {
 en: {home:'Home',dashboard:'Dashboard',network:'My Network',devices:'Devices',bluetooth:'Bluetooth Tools',profile:'Profile',users:'Users & Access',settings:'Settings',doctor:'Wi-Fi Doctor',back:'Back',signout:'Sign out',welcome:'Welcome back',tutorialTitle:'Quick tour',tutorialText:'Start at Home, add your authorised network, check device information when supported, and use Wi-Fi Doctor for troubleshooting.',next:'Got it',notifyOn:'Notifications enabled',notifyOff:'Notifications are not enabled',saved:'Preferences saved.'},
 sw: {home:'Nyumbani',dashboard:'Dashibodi',network:'Mtandao wangu',devices:'Vifaa',bluetooth:'Vifaa vya Bluetooth',profile:'Wasifu',users:'Watumiaji na ruhusa',settings:'Mipangilio',doctor:'Daktari wa Wi-Fi',back:'Rudi',signout:'Toka',welcome:'Karibu tena',tutorialTitle:'Mwongozo mfupi',tutorialText:'Anza Nyumbani, ongeza mtandao unaoruhusiwa kusimamia, angalia taarifa za vifaa vinavyoungwa mkono, na tumia Daktari wa Wi-Fi kupata msaada.',next:'Nimeelewa',notifyOn:'Arifa zimewezeshwa',notifyOff:'Arifa hazijawezeshwa',saved:'Mipangilio imehifadhiwa.'},
 fr: {home:'Accueil',dashboard:'Tableau de bord',network:'Mon réseau',devices:'Appareils',bluetooth:'Outils Bluetooth',profile:'Profil',users:'Utilisateurs et accès',settings:'Paramètres',doctor:'Assistant Wi-Fi',back:'Retour',signout:'Déconnexion',welcome:'Bon retour',tutorialTitle:'Guide rapide',tutorialText:'Commencez à l’accueil, ajoutez un réseau autorisé, consultez les appareils pris en charge et utilisez l’assistant Wi-Fi pour le dépannage.',next:'Compris',notifyOn:'Notifications activées',notifyOff:'Notifications non activées',saved:'Préférences enregistrées.'}
};
export function readPreferences(){ try{return {...DEFAULT_PREFS,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')};}catch{return {...DEFAULT_PREFS};} }
export function applyPreferences(prefs=readPreferences()) {
  const root=document.documentElement;
  let selectedTheme=prefs.theme||'system';
  if(selectedTheme==='system') selectedTheme=window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const theme=THEMES[selectedTheme]||THEMES.dark;
  const fonts={modern:"'Manrope','DM Sans',system-ui,sans-serif",inter:"Inter,'Segoe UI',sans-serif",system:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",serif:"Georgia,'Times New Roman',serif",mono:"'SFMono-Regular',Consolas,monospace"};
  root.style.setProperty('--app-font',fonts[prefs.font]||fonts.modern); root.dataset.font=prefs.font||'modern';
  root.style.setProperty('--bg',theme.bg); root.style.setProperty('--panel',theme.panel.replace(/,\s*\.\d+\)/,`,${Math.min(100,Math.max(25,Number(prefs.opacity)||82))/100})`));
  root.style.setProperty('--purple',prefs.accent||theme.accent); root.style.setProperty('--purple-strong',theme.strong);
  root.style.setProperty('--glass-opacity',String(Math.min(100,Math.max(25,Number(prefs.opacity)||82))/100));
  root.style.setProperty('--glass-blur',`${Math.min(40,Math.max(0,Number(prefs.blur)||0)}px)`);
  root.dataset.theme=selectedTheme; root.dataset.themePreference=prefs.theme||'system'; document.documentElement.lang=prefs.language||'en';
  document.body.classList.toggle('offline-mode', !!prefs.offlineMode);
  if(prefs.offlineMode) setOfflineBanner('Offline mode is enabled. Cloud sync and live router controls are paused.'); else setOfflineBanner(navigator.onLine?'':'You are offline. Cached pages may still work.');
  document.querySelectorAll('.panel,.stat-card,.welcome-panel').forEach(el=>{el.style.background=`linear-gradient(145deg, rgba(${prefs.theme==='light'?'255,255,255':'27,27,43'},${Math.min(100,Math.max(25,Number(prefs.opacity)||82))/100}), rgba(${prefs.theme==='light'?'248,247,252':'17,17,28'},${Math.min(100,Math.max(25,Number(prefs.opacity)||82))/100}))`;});
  document.querySelectorAll('.sidebar,.topbar').forEach(el=>{el.style.backdropFilter=`blur(${Math.min(40,Math.max(0,Number(prefs.blur)||0)}px)`;el.style.webkitBackdropFilter=`blur(${Math.min(40,Math.max(0,Number(prefs.blur)||0)}px)`;});
  const dict=LANG[prefs.language]||LANG.en;
  document.querySelectorAll('.sidebar-nav a').forEach(a=>{const txt=a.querySelector('span:last-child');if(!txt)return;const href=a.getAttribute('href')||'';const key=href.includes('dashboard')?'dashboard':href.includes('network')?'network':href.includes('devices')?'devices':href.includes('bluetooth')?'bluetooth':href.includes('profile')?'profile':href.includes('users')?'users':href.includes('settings')?'settings':href.includes('ai-tutor')?'doctor':href.includes('home')?'home':null;if(key)txt.textContent=dict[key];});
}
function setOfflineBanner(text){let el=document.getElementById('wifiHubOfflineBanner');if(!text){el?.remove();return;}if(!el){el=document.createElement('div');el.id='wifiHubOfflineBanner';el.className='offline-banner';el.setAttribute('role','status');document.body.prepend(el);}el.textContent='◉  '+text;}
window.addEventListener('offline',()=>setOfflineBanner('You are offline. Cached pages may still work.'));window.addEventListener('online',()=>{if(!readPreferences().offlineMode)setOfflineBanner('');});
function showToast(text){let el=document.getElementById('wifiHubToast');if(!el){el=document.createElement('div');el.id='wifiHubToast';el.className='wifi-hub-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),4200);}
function setupBackButton(){const left=$('.topbar-left');if(!left||$('#appBackButton'))return;const b=document.createElement('button');b.id='appBackButton';b.type='button';b.className='btn btn-quiet app-back-button';b.textContent=(LANG[readPreferences().language]||LANG.en).back;b.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='./home.html';});left.prepend(b);}
function setupWelcomeAndTutorial(){
  if(!localStorage.getItem('wifiHubTutorialSeenV1')&&location.pathname.toLowerCase().endsWith('/home.html')){const wrap=document.createElement('div');wrap.className='tutorial-backdrop';wrap.innerHTML=`<section class="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorialTitle"><div class="eyebrow">WI-FI HUB</div><h2 id="tutorialTitle"></h2><p id="tutorialText"></p><ol><li>Save your own or authorised network.</li><li>Use Wi-Fi Doctor for everyday connection issues.</li><li>Use Bluetooth Tools only with compatible devices.</li></ol><button class="btn btn-primary" id="tutorialDone" type="button"></button><button class="btn btn-quiet" id="tutorialSkip" type="button">Skip</button></section>`;document.body.append(wrap);const d=LANG[readPreferences().language]||LANG.en;wrap.querySelector('#tutorialTitle').textContent=d.tutorialTitle;wrap.querySelector('#tutorialText').textContent=d.tutorialText;wrap.querySelector('#tutorialDone').textContent=d.next;const close=()=>{localStorage.setItem('wifiHubTutorialSeenV1','1');wrap.remove();};wrap.querySelector('#tutorialDone').addEventListener('click',close);wrap.querySelector('#tutorialSkip').addEventListener('click',close);}}
function setupBrowserNotifications(){const btn=$('#enableNotifications');if(!btn)return;const status=$('#notificationStatus');const update=()=>{if(status)status.textContent=('Notification' in window&&Notification.permission==='granted')?'Browser notifications are enabled.':'Browser notifications require your permission and a supported browser.';};update();btn.addEventListener('click',async()=>{if(!('Notification'in window)){if(status)status.textContent='This browser does not support notifications.';return;}try{const result=await Notification.requestPermission();const prefs=readPreferences();prefs.notifications=result==='granted';localStorage.setItem(PREF_KEY,JSON.stringify(prefs));update();if(result==='granted'){new Notification('Wi-Fi Hub',{body:'Notifications are enabled on this browser.'});showToast((LANG[prefs.language]||LANG.en).notifyOn);}else if(status)status.textContent='Permission was not granted. You can change it in browser settings.';}catch{if(status)status.textContent='Could not request notification permission.';}});}
export function initPreferences(){applyPreferences();setupBackButton();setupWelcomeAndTutorial();setupBrowserNotifications();}
document.addEventListener('DOMContentLoaded',()=>{applyPreferences();setupBackButton();setupWelcomeAndTutorial();setupBrowserNotifications();});

if(window.matchMedia){const mq=window.matchMedia('(prefers-color-scheme: light)');const updateSystemTheme=()=>{if(readPreferences().theme==='system')applyPreferences();};mq.addEventListener?mq.addEventListener('change',updateSystemTheme):mq.addListener(updateSystemTheme);}
