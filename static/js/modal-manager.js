// ============================================
// ModalManager - Modal Dialog Management
// ============================================

class ModalManager {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.overlay = this.modal.querySelector('.modal-overlay');
    this.content = this.modal.querySelector('.modal-content');
    this.closeButtons = this.modal.querySelectorAll('.close-btn, [data-modal-close]');
    this.isOpen = false;
    this.focusableElements = [];
    this.previouslyFocusedElement = null;
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for modal
   */
  setupEventListeners() {
    // Close on overlay click
    this.overlay.addEventListener('click', () => this.close());
    
    // Close on close button click
    this.closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    // Trap focus within modal
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.isOpen) {
        this.handleTabKey(e);
      }
    });
  }

  /**
   * Open the modal
   * @param {Function} onOpen - Optional callback after modal opens
   */
  open(onOpen = null) {
    if (this.isOpen) return;
    
    // Store currently focused element
    this.previouslyFocusedElement = document.activeElement;
    
    // Show modal
    this.modal.classList.add('open');
    this.modal.classList.remove('closing');
    this.isOpen = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Get focusable elements
    this.updateFocusableElements();
    
    // Focus first focusable element
    setTimeout(() => {
      if (this.focusableElements.length > 0) {
        this.focusableElements[0].focus();
      }
    }, 100);
    
    // Call onOpen callback
    if (onOpen) {
      onOpen();
    }
  }

  /**
   * Close the modal
   * @param {Function} onClose - Optional callback after modal closes
   */
  close(onClose = null) {
    if (!this.isOpen) return;
    
    // Add closing animation
    this.modal.classList.add('closing');
    
    // Wait for animation to complete
    setTimeout(() => {
      this.modal.classList.remove('open', 'closing');
      this.isOpen = false;
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Restore focus to previously focused element
      if (this.previouslyFocusedElement) {
        this.previouslyFocusedElement.focus();
        this.previouslyFocusedElement = null;
      }
      
      // Call onClose callback
      if (onClose) {
        onClose();
      }
    }, 300); // Match animation duration
  }

  /**
   * Update list of focusable elements
   */
  updateFocusableElements() {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    this.focusableElements = Array.from(
      this.content.querySelectorAll(focusableSelectors.join(','))
    ).filter(el => {
      return el.offsetParent !== null; // Only visible elements
    });
  }

  /**
   * Handle Tab key for focus trapping
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleTabKey(e) {
    if (this.focusableElements.length === 0) return;
    
    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Check if modal is open
   * @returns {boolean} True if modal is open
   */
  isModalOpen() {
    return this.isOpen;
  }
}

// ============================================
// ConfirmDialog - Confirmation Dialog
// ============================================

class ConfirmDialog extends ModalManager {
  constructor() {
    super('confirm-modal');
    this.confirmTitle = document.getElementById('confirm-title');
    this.confirmMessage = document.getElementById('confirm-message');
    this.confirmOkBtn = document.getElementById('confirm-ok');
    this.confirmCancelBtn = document.getElementById('confirm-cancel');
    this.confirmCloseBtn = document.getElementById('confirm-close');
    
    this.resolveCallback = null;
    this.rejectCallback = null;
    
    this.setupConfirmListeners();
  }

  /**
   * Set up confirmation dialog listeners
   */
  setupConfirmListeners() {
    this.confirmOkBtn.addEventListener('click', () => {
      if (this.resolveCallback) {
        this.resolveCallback(true);
      }
      this.close();
    });

    this.confirmCancelBtn.addEventListener('click', () => {
      if (this.resolveCallback) {
        this.resolveCallback(false);
      }
      this.close();
    });

    this.confirmCloseBtn.addEventListener('click', () => {
      if (this.resolveCallback) {
        this.resolveCallback(false);
      }
      this.close();
    });
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @param {string} title - Dialog title
   * @param {string} okText - OK button text
   * @param {string} cancelText - Cancel button text
   * @returns {Promise<boolean>} Promise that resolves to true if confirmed
   */
  confirm(message, title = 'Confirm Action', okText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      this.confirmTitle.textContent = title;
      this.confirmMessage.textContent = message;
      this.confirmOkBtn.textContent = okText;
      this.confirmCancelBtn.textContent = cancelText;
      
      this.resolveCallback = resolve;
      
      this.open();
    });
  }

  /**
   * Override close to clean up callbacks
   */
  close(onClose = null) {
    super.close(() => {
      this.resolveCallback = null;
      this.rejectCallback = null;
      if (onClose) onClose();
    });
  }
}

export { ModalManager, ConfirmDialog };
