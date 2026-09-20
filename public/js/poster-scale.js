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
    // Measure the sheet's own untransformed width, not the scaled box, so
    // drop the class first or this reads back the already-scaled size.
    scaler.classList.remove('is-scaled');
    var natural = sheet.offsetWidth;
    var available = scaler.clientWidth;
    var scale = natural > available ? available / natural : 1;

    if (scale === 1) {
      // Fits as it is. Leave the sheet entirely alone so its own
      // `margin: 0 auto` keeps it centred: the scaling rules zero those
      // margins, which is what once pinned the poster to the left edge on
      // every screen wide enough not to need scaling at all.
      sheet.style.removeProperty('--sheet-scale');
      scaler.style.height = '';
      return;
    }

    scaler.classList.add('is-scaled');
    sheet.style.setProperty('--sheet-scale', String(scale));
    // The scaled sheet still reserves its full unscaled height in flow,
    // which would leave a tall blank gap underneath it.
    scaler.style.height = sheet.offsetHeight * scale + 'px';
  }

  update();
  window.addEventListener('resize', update);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
})();
