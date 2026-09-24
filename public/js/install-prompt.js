// The "put it on your home screen" notice, owner request: the public home
// page and the admin queue. The markup and the reasoning for its two
// versions are in src/templates/installPrompt.js; this decides whether
// and which to show.
(function () {
  var notice = document.querySelector('[data-install-prompt]');
  if (!notice) return;

  // Per app, from the markup, so the public site and the admin panel each
  // remember their own dismissal.
  var DISMISSED_KEY = notice.getAttribute('data-install-key') || 'cbr_install_prompt_dismissed';

  // Storage can be missing or throw (private browsing, blocked site
  // data). Worst case the notice shows again next visit, which is fine.
  function wasDismissed() {
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function rememberDismissed() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch (err) {
      // Nothing to do: see wasDismissed.
    }
  }

  // Already opened from the home screen: there's nothing to install.
  // navigator.standalone is iOS's own flag, display-mode everyone else's.
  function isInstalled() {
    return window.navigator.standalone === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  // iPhone, or an iPad, which reports itself as a Mac with a touch screen.
  // Chrome, Firefox and Edge on iOS have Add to Home Screen in their share
  // sheets too (iOS 16.4 on), so they get the same note. In-app browsers
  // (Instagram, Facebook) can't add to the home screen at all, so they
  // don't.
  function isIosWithAddToHomeScreen() {
    var ua = window.navigator.userAgent;
    var isIos = /iPhone|iPad|iPod/.test(ua)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    var inAppBrowser = /FBAN|FBAV|Instagram|Line\//.test(ua);
    return isIos && !inAppBrowser;
  }

  function showVariant(variant) {
    notice.querySelectorAll('[data-install-variant]').forEach(function (el) {
      el.hidden = el.getAttribute('data-install-variant') !== variant;
    });
    notice.hidden = false;
    document.body.classList.add('has-install-prompt');
  }

  function hide() {
    notice.hidden = true;
    document.body.classList.remove('has-install-prompt');
  }

  if (wasDismissed() || isInstalled()) return;

  var deferredPrompt = null;

  notice.querySelector('[data-install-dismiss]').addEventListener('click', function () {
    rememberDismissed();
    hide();
  });

  notice.querySelector('[data-install-accept]').addEventListener('click', function () {
    if (!deferredPrompt) return;
    var promptEvent = deferredPrompt;
    // A held install event can only be used once.
    deferredPrompt = null;
    hide();
    promptEvent.prompt();
    promptEvent.userChoice.then(function (choice) {
      // Said no in the browser's own dialog: that's an answer, so don't
      // offer again. Said yes: the app is on the way and appinstalled
      // below also covers it.
      if (choice && choice.outcome === 'dismissed') rememberDismissed();
    }).catch(function () {});
  });

  // Chrome, Edge and Samsung Internet fire this once the site is
  // installable. Holding it (preventDefault) swaps the browser's own mini
  // bar for this notice, and the Install button hands it back. The
  // browser decides when that is, and can wait until someone has used the
  // page for a moment, so on those browsers the notice can appear a
  // little after the board rather than with it.
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showVariant('prompt');
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    rememberDismissed();
    hide();
  });

  if (isIosWithAddToHomeScreen()) {
    notice.querySelector('[data-install-dismiss]').textContent = 'Got it';
    showVariant('ios');
  }
})();
