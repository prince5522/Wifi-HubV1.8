
const $ = (selector) => document.querySelector(selector);

let auth;
let db;
let currentUser = null;
let currentProfile = {};

function showMessage(text, type = 'error') {
  const el = $('#profileMessage');
  if (el) {
    el.textContent = text;
    el.className = `form-message ${type}`;
  }
}

function setStatus(text) {
  const el = $('#profileAccountState');
  if (el) el.textContent = text;
}

function explain(error) {
  console.error('[Wi-Fi Hub Profile]', error);

  const code = error?.code || '';
  const message = error?.message || String(error);

  if (code === 'permission-denied' ||
      code === 'firestore/permission-denied') {
    return 'Firestore access denied. Check Firestore Rules for users/{uid}.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Firebase network request failed. Check your internet connection.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'This website domain is not authorised in Firebase Authentication.';
  }

  return `${code ? code + ': ' : ''}${message}`;
}

function fillUser(user, profile = {}) {
  const name = profile.name || user.displayName || '';

  if ($('#profileName')) $('#profileName').value = name;
  if ($('#profileEmail')) $('#profileEmail').value = user.email || '';
  if ($('#profileUid')) $('#profileUid').value = user.uid || '';

  if ($('#profileProvider')) {
    $('#profileProvider').value =
      (user.providerData || [])
        .map(provider => provider.providerId)
        .join(', ') || 'Unknown';
  }

  if ($('#profileCreatedAt')) {
    $('#profileCreatedAt').textContent =
      user.metadata?.creationTime || 'Not available';
  }

  if ($('#profileLastSignIn')) {
    $('#profileLastSignIn').textContent =
      user.metadata?.lastSignInTime || 'Not available';
  }

  if ($('#accountChip')) {
    $('#accountChip').textContent =
      name || user.email || 'Signed in';
  }

  setStatus(profile.active === false ? 'Disabled' : 'Signed in');
}

async function loadProfile(user) {
  currentUser = user;
  fillUser(user);
  setStatus('Signed in; loading saved profile…');

  try {
    const { doc, getDoc } = await import(
      'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js'
    );

    const snap = await getDoc(doc(db, 'users', user.uid));

    if (snap.exists()) {
      currentProfile = snap.data() || {};
      fillUser(user, currentProfile);
      showMessage('Profile loaded successfully.', 'success');
    } else {
      currentProfile = {};
      showMessage(
        'Signed in successfully, but no Firestore profile exists yet. Enter your name and click Save profile.',
        'error'
      );
    }
  } catch (error) {
    showMessage('Could not load saved profile: ' + explain(error));
  }
}

async function startProfile() {
  setStatus('Connecting to Firebase…');

  try {
    const core = await import('./firebase.js');
    auth = core.auth;
    db = core.db;

    const authSdk = await import(
      'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'
    );

    setStatus('Checking your sign-in…');

    let initialStateReceived = false;

    const unsubscribe = authSdk.onAuthStateChanged(
      auth,
      async user => {
        initialStateReceived = true;

        if (!user) {
          setStatus('Not signed in');
          showMessage(
            'No signed-in Firebase account was found. Please sign in again.'
          );
          return;
        }

        await loadProfile(user);
      },
      error => {
        setStatus('Authentication error');
        showMessage('Firebase sign-in check failed: ' + explain(error));
      }
    );

    // Reveal a useful error if Firebase never returns an initial auth state.
    window.setTimeout(() => {
      if (!initialStateReceived) {
        setStatus('Firebase is not responding');
        showMessage(
          'Firebase sign-in check is taking too long. Check the browser Console for a network or import error, then refresh.'
        );
      }
    }, 10000);

    window.addEventListener('pagehide', unsubscribe, { once: true });
  } catch (error) {
    setStatus('Profile script failed');
    showMessage(
      'The profile could not start. Check the Firebase imports and file paths: ' +
      explain(error)
    );
  }
}

$('#profileForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!currentUser || !db) {
    showMessage('Firebase has not finished signing in. Read the status message above.');
    return;
  }

  const name = $('#profileName')?.value.trim();

  if (!name) {
    showMessage('Enter your display name before saving.');
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  if (button) button.disabled = true;

  try {
    const { doc, getDoc, setDoc, serverTimestamp } = await import(
      'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js'
    );
    const { updateProfile } = await import(
      'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'
    );

    const ref = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);

    const data = {
      name,
      email: currentUser.email || '',
      updatedAt: serverTimestamp()
    };

    if (!snap.exists()) {
      data.role = 'user';
      data.active = true;
      data.createdAt = serverTimestamp();
    }

    await updateProfile(currentUser, { displayName: name });
    await setDoc(ref, data, { merge: true });

    currentProfile = { ...currentProfile, ...data, name };
    fillUser(currentUser, currentProfile);
    showMessage('Profile saved successfully.', 'success');
  } catch (error) {
    showMessage('Could not save profile: ' + explain(error));
  } finally {
    if (button) button.disabled = false;
  }
});

$('#sendResetEmail')?.addEventListener('click', async () => {
  try {
    if (!currentUser?.email) {
      throw new Error('No email address is attached to this account.');
    }

    const { sendPasswordResetEmail } = await import(
      'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'
    );

    await sendPasswordResetEmail(auth, currentUser.email);
    showMessage('Password reset email sent.', 'success');
  } catch (error) {
    showMessage('Password reset failed: ' + explain(error));
  }
});

startProfile();
