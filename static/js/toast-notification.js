// ============================================
// ToastNotification - User Feedback System
// ============================================

class ToastNotification {
  constructor() {
    this.container = document.getElementById('toast-container');
    this.toasts = new Map(); // Map of toast element to timer ID
    this.maxToasts = 5; // Maximum number of toasts to show at once
  }

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms (0 = no auto-dismiss)
   * @param {string} title - Optional title for the toast
   * @returns {HTMLElement} Toast element
   */
  show(message, type = 'info', duration = 5000, title = null) {
    // Remove oldest toast if we've reached the limit
    if (this.toasts.size >= this.maxToasts) {
      const oldestToast = this.toasts.keys().next().value;
      this.dismiss(oldestToast);
    }

    const toast = this.createToast(message, type, title);
    this.container.appendChild(toast);

    // Trigger entrance animation by adding to DOM
    // The CSS animation will play automatically

    // Set up auto-dismiss timer
    let timerId = null;
    if (duration > 0) {
      timerId = setTimeout(() => this.dismiss(toast), duration);
    }

    this.toasts.set(toast, timerId);

    // Announce to screen readers
    this.announceToScreenReader(message, type);

    return toast;
  }

  /**
   * Create toast element
   * @param {string} message - Message text
   * @param {string} type - Toast type
   * @param {string} title - Optional title
   * @returns {HTMLElement} Toast element
   */
  createToast(message, type, title) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const titleHtml = title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : '';

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <div class="toast-content">
        ${titleHtml}
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close notification">×</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.dismiss(toast));

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => this.pauseDismiss(toast));
    toast.addEventListener('mouseleave', () => this.resumeDismiss(toast));

    return toast;
  }

  /**
   * Dismiss a toast with animation
   * @param {HTMLElement} toast - Toast element to dismiss
   */
  dismiss(toast) {
    if (!toast || !toast.parentNode) {
      return;
    }

    // Clear any existing timer
    const timerId = this.toasts.get(toast);
    if (timerId) {
      clearTimeout(timerId);
    }

    // Add removing class to trigger exit animation
    toast.classList.add('removing');

    // Remove from DOM after animation completes
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.toasts.delete(toast);
    }, 300); // Match animation duration
  }

  /**
   * Pause auto-dismiss timer
   * @param {HTMLElement} toast - Toast element
   */
  pauseDismiss(toast) {
    const timerId = this.toasts.get(toast);
    if (timerId) {
      clearTimeout(timerId);
      this.toasts.set(toast, null);
    }
  }

  /**
   * Resume auto-dismiss timer
   * @param {HTMLElement} toast - Toast element
   * @param {number} duration - Duration in ms
   */
  resumeDismiss(toast, duration = 2000) {
    if (this.toasts.has(toast) && this.toasts.get(toast) === null) {
      const timerId = setTimeout(() => this.dismiss(toast), duration);
      this.toasts.set(toast, timerId);
    }
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    const toastElements = Array.from(this.toasts.keys());
    toastElements.forEach(toast => this.dismiss(toast));
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} type - Toast type
   */
  announceToScreenReader(message, type) {
    const announcement = `${type}: ${message}`;
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = announcement;
    
    document.body.appendChild(liveRegion);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show success toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms
   * @param {string} title - Optional title
   * @returns {HTMLElement} Toast element
   */
  success(message, duration = 5000, title = null) {
    return this.show(message, 'success', duration, title);
  }

  /**
   * Show error toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (0 = no auto-dismiss)
   * @param {string} title - Optional title
   * @returns {HTMLElement} Toast element
   */
  error(message, duration = 0, title = null) {
    return this.show(message, 'error', duration, title || 'Error');
  }

  /**
   * Show warning toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms
   * @param {string} title - Optional title
   * @returns {HTMLElement} Toast element
   */
  warning(message, duration = 7000, title = null) {
    return this.show(message, 'warning', duration, title);
  }

  /**
   * Show info toast
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms
   * @param {string} title - Optional title
   * @returns {HTMLElement} Toast element
   */
  info(message, duration = 5000, title = null) {
    return this.show(message, 'info', duration, title);
  }
}

export default ToastNotification;
