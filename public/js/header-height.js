// Keeps --header-height in sync with the site header's real rendered
// height, so the board's column headings can be stuck directly beneath
// it (see .board-column h2 in style.css).
//
// The height is not a constant that could just be hardcoded: the site
// name and slogan use clamp() sizes that scale with the viewport, the
// slogan can wrap inside its strip, and the nav wraps to more rows as the
// window narrows. A fixed guess would be right at one width and wrong at
// every other, leaving a gap or an overlap between the two frozen things.
//
// A ResizeObserver rather than a resize listener: it fires for every
// reason the header changes size, including the web fonts landing and the
// nav rewrapping, not just the window changing.
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  function update() {
    document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
  }

  update();

  if (window.ResizeObserver) {
    new ResizeObserver(update).observe(header);
    return;
  }

  // Fallback for anything without ResizeObserver: the two moments the
  // header's height actually changes.
  window.addEventListener('resize', update);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
})();
