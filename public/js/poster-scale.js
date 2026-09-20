// Scales the on-screen poster preview down to fit a narrow viewport. The
// sheet is sized in real-world millimetres (A4 is 210mm, about 794px), so
// on a phone it overflowed the page sideways. Printing is unaffected: the
// transform lives in a screen-only media query, and this sets the scale
// to 1 whenever the sheet already fits.
(function () {
  var scaler = document.querySelector('.sheet-scaler');
  var sheet = scaler && scaler.querySelector('.sheet');
  if (!sheet) return;

  function update() {
    // Measure the sheet's own untransformed width, not the scaled box.
    var natural = sheet.offsetWidth;
    var available = scaler.clientWidth;
    var scale = natural > available ? available / natural : 1;
    sheet.style.setProperty('--sheet-scale', String(scale));
    // The scaled sheet still reserves its full unscaled height in flow,
    // which would leave a tall blank gap underneath it.
    scaler.style.height = scale < 1 ? sheet.offsetHeight * scale + 'px' : '';
  }

  update();
  window.addEventListener('resize', update);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
})();
