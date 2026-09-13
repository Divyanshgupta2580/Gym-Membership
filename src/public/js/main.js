document.addEventListener('DOMContentLoaded', () => {
  // Mobile Sidebar Toggle
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.app-sidebar');

  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
      if (
        sidebar.classList.contains('is-open') &&
        !sidebar.contains(e.target) &&
        !mobileBtn.contains(e.target)
      ) {
        sidebar.classList.remove('is-open');
      }
    });
  }

  // Alert Dismissal
  document.querySelectorAll('.alert-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const alert = btn.closest('.alert');
      if (alert) {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 200);
      }
    });
  });

  // Modal Dialog Handlers
  document.querySelectorAll('[data-modal-target]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const targetId = trigger.getAttribute('data-modal-target');
      const modal = document.getElementById(targetId);
      if (modal) {
        modal.classList.add('is-open');
      }
    });
  });

  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) {
        modal.classList.remove('is-open');
      }
    });
  });

  // Close modal when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-open');
      }
    });
  });
});
