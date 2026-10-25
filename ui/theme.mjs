/* Apply the saved preference before styles load; both pages share this control. */
(() => {
  const key = 'nube.theme.v1';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* System theme remains available. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = theme === 'dark' ? 'claro' : 'oscuro';
      button.setAttribute('aria-label', `Activar modo ${next}`);
      button.title = `Activar modo ${next}`;
      button.removeAttribute('aria-pressed');
      button.querySelector('[data-theme-label]').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
    });
  }
  apply();
  system.addEventListener('change', () => { if (!preference) apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); }
      catch { document.querySelector('#storage-notice').hidden = false; }
      apply();
    }));
  });
})();
