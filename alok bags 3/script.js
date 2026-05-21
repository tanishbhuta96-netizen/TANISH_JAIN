/* ═══════════════════════════════════════════
   ALOK BAGS — Dashboard Script
   ═══════════════════════════════════════════ */

// ── Active nav link toggle ──
function setupNavToggle(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const links = container.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', e => {
      // Allow real links (not "#") to navigate normally
      const href = link.getAttribute('href');
      if (href && href !== '#') return;
      e.preventDefault();
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

setupNavToggle('.top-nav__links');
setupNavToggle('.sub-nav ul');

// ── Tile click feedback ──
document.querySelectorAll('.tile').forEach(tile => {
  tile.addEventListener('click', e => {
    const href = tile.getAttribute('href');
    const name = tile.querySelector('.tile__name')?.textContent || 'Module';

    // Quick ripple‑pulse visual feedback
    tile.style.transition = 'transform 0.1s';
    tile.style.transform = 'scale(0.96)';

    // If tile has a real link, navigate after the pulse effect
    if (href && href !== '#') {
      e.preventDefault();
      setTimeout(() => { window.location.href = href; }, 120);
    } else {
      e.preventDefault();
      setTimeout(() => {
        tile.style.transform = '';
        tile.style.transition = '';
      }, 120);
    }

    console.log(`[ALOK BAGS] Navigating to: ${name}`);
  });
});

// ── Stat card counter animation ──
function animateValue(el, start, end, duration) {
  const text = el.textContent;
  const prefix = text.match(/^[^\d]*/)?.[0] || '';
  const suffix = text.match(/[^\d.]*$/)?.[0] || '';
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Run counters on load
window.addEventListener('DOMContentLoaded', () => {
  const values = document.querySelectorAll('.stat-value');
  const targets = [142, 8.4, 1.2, 3840];
  const displays = ['142', '₹8.4L', '₹1.2L', '3,840'];

  values.forEach((el, i) => {
    const raw = targets[i];
    // For currency values with "L" suffix, skip counter and just display
    if (typeof raw === 'number' && raw > 100) {
      animateValue(el, 0, raw, 800);
    } else {
      // Animate a simple integer representation then restore display
      el.textContent = displays[i];
    }
  });
});
