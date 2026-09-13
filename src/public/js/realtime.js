(() => {
  if (typeof io === 'undefined') {
    return;
  }

  const socket = io({
    reconnectionAttempts: 5,
    timeout: 10000
  });

  // Create temporary notification banner helper
  function showLiveToast(message, type = 'info') {
    const container = document.getElementById('live-toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'error' : 'success'} live-toast`;
    toast.style.cssText = 'box-shadow: var(--shadow-lg); margin-bottom: 8px; animation: slideIn 0.2s ease;';
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button type="button" class="alert-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.alert-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
      }
    }, 6000);
  }

  function createToastContainer() {
    const c = document.createElement('div');
    c.id = 'live-toast-container';
    c.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; max-width: 380px; width: 100%;';
    document.body.appendChild(c);
    return c;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Handle new attendance check-ins
  socket.on('attendance:new', (data) => {
    // Increment today attendance count if on admin dashboard
    const counter = document.getElementById('stat-today-attendance');
    if (counter) {
      const currentVal = parseInt(counter.textContent, 10) || 0;
      counter.textContent = currentVal + 1;
    }

    // Prepend to live activity feed if present
    const feed = document.getElementById('live-activity-feed');
    if (feed) {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-dot"></div>
        <div class="activity-content">
          <div><strong>${escapeHtml(data.memberName)}</strong> checked in</div>
          <div class="activity-time">Just now (Streak: ${data.streak}d)</div>
        </div>
      `;
      feed.insertBefore(item, feed.firstChild);

      // Keep maximum 10 items in DOM
      if (feed.children.length > 10) {
        feed.removeChild(feed.lastChild);
      }
    }

    // Show toast for trainers or admins
    showLiveToast(`Member check-in: ${data.memberName} (Streak: ${data.streak} days)`, 'success');
  });

  // Handle trainer assignment notifications
  socket.on('trainer:assigned', (data) => {
    showLiveToast(data.message, 'info');
  });

  // Handle membership status update
  socket.on('membership:updated', (data) => {
    showLiveToast(`Membership status updated: ${data.planName} is now ${data.status}`, 'info');
  });
})();
