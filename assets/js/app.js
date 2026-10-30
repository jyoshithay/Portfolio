/* ============================================================
   Jyoshitha Yannam — portfolio behaviour
   ============================================================ */

(function () {
  'use strict';

  // Theme handling
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  const initTheme = () => {
    const setTheme = (dark) => {
      html.classList.toggle('dark', dark);
      themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };

    const saved = localStorage.getItem('theme');
    setTheme(saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

    themeToggle.addEventListener('click', () => {
      const dark = !html.classList.contains('dark');
      setTheme(dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });
  };

  // Mobile nav toggle
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav');

  const initNav = () => {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    const closeNav = () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });
  };

  // Smooth scroll for nav
  const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          const offsetTop = target.getBoundingClientRect().top + window.scrollY - 68;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      });
    });
  };

  // Initialize
  initTheme();
  initNav();
  initSmoothScroll();
})();
