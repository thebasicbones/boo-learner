// ============================================
// boo-learner - Modern UI Application
// ============================================

// ============================================
// Custom Error Classes
// ============================================

class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// ============================================
// StateManager - Reactive State Management
// ============================================

class StateManager {
  constructor() {
    this.state = {
      courses: [],
      selectedCourse: null,
      viewMode: 'graph', // 'graph' | 'timeline' | 'list'
      searchQuery: '',
      filters: { status: 'all' }, // 'all' | 'completed' | 'available' | 'locked'
      graphLayout: {},
      completedCourses: new Set(),
      preferences: {
        viewMode: 'graph',
        animationsEnabled: true,
        graphPhysics: {
          linkDistance: 150,
          chargeStrength: -400
        }
      }
    };
    this.subscribers = [];
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => this.unsubscribe(callback);
  }

  /**
   * Unsubscribe from state changes
   * @param {Function} callback - Function to remove from subscribers
   */
  unsubscribe(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }
  }

  /**
   * Update state and notify subscribers
   * @param {Object} updates - Partial state updates
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  /**
   * Notify all subscribers of state change
   */
  notify() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Toggle course completion status
   * @param {string} courseId - Course ID to toggle
   */
  toggleCompletion(courseId) {
    const completedCourses = new Set(this.state.completedCourses);
    if (completedCourses.has(courseId)) {
      completedCourses.delete(courseId);
    } else {
      completedCourses.add(courseId);
    }
    this.setState({ completedCourses });
  }

  /**
   * Check if a course is completed
   * @param {string} courseId - Course ID to check
   * @returns {boolean} True if completed
   */
  isCompleted(courseId) {
    return this.state.completedCourses.has(courseId);
  }

  /**
   * Check if a course is available (all dependencies completed)
   * @param {Object} course - Course object
   * @returns {boolean} True if available
   */
  isAvailable(course) {
    if (!course.dependencies || course.dependencies.length === 0) {
      return true;
    }
    return course.dependencies.every(depId => this.isCompleted(depId));
  }
}

// ============================================
// APIClient - HTTP Client with Retry Logic
// ============================================

class APIClient {
  constructor(baseURL = '/api/v1') {
    this.baseURL = baseURL;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // Base delay in ms
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: response.statusText };
          }
          
          throw new APIError(
            errorData.detail || errorData.message || 'Request failed',
            response.status,
            errorData
          );
        }
        
        // Handle 204 No Content
        if (response.status === 204) {
          return null;
        }
        
        return await response.json();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof APIError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === this.retryAttempts - 1) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delayTime = this.retryDelay * Math.pow(2, attempt);
        console.log(`Request failed, retrying in ${delayTime}ms... (attempt ${attempt + 1}/${this.retryAttempts})`);
        await this.delay(delayTime);
      }
    }

    throw lastError;
  }

  /**
   * Get all courses
   * @returns {Promise<Array>} Array of courses
   */
  async getCourses() {
    return this.request('/resources');
  }

  /**
   * Get a single course by ID
   * @param {string} id - Course ID
   * @returns {Promise<Object>} Course object
   */
  async getCourse(id) {
    return this.request(`/resources/${id}`);
  }

  /**
   * Create a new course
   * @param {Object} data - Course data
   * @returns {Promise<Object>} Created course
   */
  async createCourse(data) {
    return this.request('/resources', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update an existing course
   * @param {string} id - Course ID
   * @param {Object} data - Updated course data
   * @returns {Promise<Object>} Updated course
   */
  async updateCourse(id, data) {
    return this.request(`/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a course
   * @param {string} id - Course ID
   * @returns {Promise} Deletion confirmation
   */
  async deleteCourse(id) {
    return this.request(`/resources/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get topologically sorted courses
   * @returns {Promise<Array>} Sorted array of courses
   */
  async getTopologicalSort() {
    return this.request('/resources/sorted');
  }
}

// ============================================
// StorageService - Local Storage Management
// ============================================

class StorageService {
  constructor() {
    this.keys = {
      PREFERENCES: 'boo-learner:preferences',
      COMPLETED_COURSES: 'boo-learner:completed',
      GRAPH_LAYOUT: 'boo-learner:graph-layout',
      PENDING_CHANGES: 'boo-learner:pending-changes'
    };
  }

  /**
   * Save data to local storage
   * @param {string} key - Storage key
   * @param {*} data - Data to save
   */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  /**
   * Load data from local storage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Loaded data or default value
   */
  load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error loading from local storage:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data from local storage
   * @param {string} key - Storage key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from local storage:', error);
    }
  }

  /**
   * Save user preferences
   * @param {Object} preferences - Preferences object
   */
  savePreferences(preferences) {
    this.save(this.keys.PREFERENCES, preferences);
  }

  /**
   * Load user preferences
   * @returns {Object} Preferences object
   */
  loadPreferences() {
    return this.load(this.keys.PREFERENCES, {
      viewMode: 'graph',
      animationsEnabled: true,
      graphPhysics: {
        linkDistance: 150,
        chargeStrength: -400
      }
    });
  }

  /**
   * Save completed courses
   * @param {Set} completedCourses - Set of completed course IDs
   */
  saveCompletedCourses(completedCourses) {
    this.save(this.keys.COMPLETED_COURSES, Array.from(completedCourses));
  }

  /**
   * Load completed courses
   * @returns {Set} Set of completed course IDs
   */
  loadCompletedCourses() {
    const courses = this.load(this.keys.COMPLETED_COURSES, []);
    return new Set(courses);
  }

  /**
   * Save graph layout positions
   * @param {Object} layout - Layout object with course positions
   */
  saveGraphLayout(layout) {
    this.save(this.keys.GRAPH_LAYOUT, layout);
  }

  /**
   * Load graph layout positions
   * @returns {Object} Layout object
   */
  loadGraphLayout() {
    return this.load(this.keys.GRAPH_LAYOUT, {});
  }

  /**
   * Save pending changes for offline support
   * @param {Array} changes - Array of pending changes
   */
  savePendingChanges(changes) {
    this.save(this.keys.PENDING_CHANGES, changes);
  }

  /**
   * Load pending changes
   * @returns {Array} Array of pending changes
   */
  loadPendingChanges() {
    return this.load(this.keys.PENDING_CHANGES, []);
  }

  /**
   * Clear all pending changes
   */
  clearPendingChanges() {
    this.remove(this.keys.PENDING_CHANGES);
  }
}

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

// ============================================
// CourseModalManager - Course Creation/Editing Modal
// ============================================

class CourseModalManager extends ModalManager {
  constructor() {
    super('course-modal');
    this.form = document.getElementById('course-form');
    this.modalTitle = document.getElementById('modal-title');
    this.submitBtn = document.getElementById('modal-submit');
    this.cancelBtn = document.getElementById('modal-cancel');
    
    this.currentCourse = null;
    this.mode = 'create'; // 'create' or 'edit'
    
    this.setupFormListeners();
  }

  /**
   * Set up form-specific event listeners
   */
  setupFormListeners() {
    // Cancel button
    this.cancelBtn.addEventListener('click', () => this.close());
    
    // Submit button
    this.submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Real-time validation with debouncing for better UX
    const nameInput = document.getElementById('course-name');
    const descInput = document.getElementById('course-description');
    const depsSelect = document.getElementById('course-dependencies');
    
    if (nameInput) {
      // Validate on blur
      nameInput.addEventListener('blur', () => this.validateField('name'));
      
      // Clear error on input and validate after typing stops
      let nameTimeout;
      nameInput.addEventListener('input', () => {
        this.clearFieldError('name');
        clearTimeout(nameTimeout);
        // Validate after 500ms of no typing
        nameTimeout = setTimeout(() => {
          if (nameInput.value.trim().length > 0) {
            this.validateField('name');
          }
        }, 500);
      });
    }
    
    if (descInput) {
      descInput.addEventListener('blur', () => this.validateField('description'));
      
      let descTimeout;
      descInput.addEventListener('input', () => {
        this.clearFieldError('description');
        clearTimeout(descTimeout);
        // Validate after 500ms of no typing
        descTimeout = setTimeout(() => {
          if (descInput.value.trim().length > 0) {
            this.validateField('description');
          }
        }, 500);
      });
    }
    
    if (depsSelect) {
      // Validate dependencies on change
      depsSelect.addEventListener('change', () => {
        this.validateField('dependencies');
      });
    }
  }

  /**
   * Open modal for creating a new course
   */
  openForCreate() {
    this.mode = 'create';
    this.currentCourse = null;
    this.modalTitle.textContent = 'Add New Course';
    this.submitBtn.textContent = 'Create Course';
    
    // Reset form
    this.form.reset();
    this.clearAllErrors();
    
    // Populate dependencies dropdown
    this.populateDependencies();
    
    this.open();
  }

  /**
   * Open modal for editing an existing course
   * @param {Object} course - Course to edit
   */
  openForEdit(course) {
    this.mode = 'edit';
    this.currentCourse = course;
    this.modalTitle.textContent = 'Edit Course';
    this.submitBtn.textContent = 'Save Changes';
    
    // Populate form with course data
    document.getElementById('course-name').value = course.name || '';
    document.getElementById('course-description').value = course.description || '';
    
    // Populate dependencies dropdown
    this.populateDependencies(course.id);
    
    // Select current dependencies
    const depsSelect = document.getElementById('course-dependencies');
    if (course.dependencies && Array.isArray(course.dependencies)) {
      Array.from(depsSelect.options).forEach(option => {
        option.selected = course.dependencies.includes(option.value);
      });
    }
    
    this.clearAllErrors();
    this.open();
  }

  /**
   * Populate dependencies dropdown
   * @param {string} excludeId - Course ID to exclude (for edit mode)
   */
  populateDependencies(excludeId = null) {
    const select = document.getElementById('course-dependencies');
    select.innerHTML = '';
    
    const courses = stateManager.state.courses;
    courses.forEach(course => {
      // Don't include the current course as a dependency option
      if (course.id !== excludeId) {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.name;
        select.appendChild(option);
      }
    });
  }

  /**
   * Validate a single form field
   * @param {string} fieldName - Field name to validate
   * @returns {boolean} True if valid
   */
  validateField(fieldName) {
    const input = document.getElementById(`course-${fieldName}`);
    const errorSpan = document.getElementById(`${fieldName}-error`);
    
    if (!input || !errorSpan) return true;
    
    let validation;
    if (fieldName === 'name') {
      validation = ValidationUtils.validateCourseName(input.value);
    } else if (fieldName === 'description') {
      validation = ValidationUtils.validateDescription(input.value);
    } else if (fieldName === 'dependencies') {
      const selectedOptions = Array.from(input.selectedOptions).map(opt => opt.value);
      validation = ValidationUtils.validateDependencies(selectedOptions, this.currentCourse?.id);
    }
    
    if (!validation.valid) {
      input.classList.add('error');
      errorSpan.textContent = validation.error;
      return false;
    }
    
    input.classList.remove('error');
    errorSpan.textContent = '';
    return true;
  }

  /**
   * Clear error for a specific field
   * @param {string} fieldName - Field name
   */
  clearFieldError(fieldName) {
    const input = document.getElementById(`course-${fieldName}`);
    const errorSpan = document.getElementById(`${fieldName}-error`);
    
    if (input) input.classList.remove('error');
    if (errorSpan) errorSpan.textContent = '';
  }

  /**
   * Clear all form errors
   */
  clearAllErrors() {
    ['name', 'description', 'dependencies'].forEach(field => {
      this.clearFieldError(field);
    });
  }

  /**
   * Handle form submission
   */
  async handleSubmit() {
    // Validate all fields
    const nameValid = this.validateField('name');
    const descValid = this.validateField('description');
    const depsValid = this.validateField('dependencies');
    
    if (!nameValid || !descValid || !depsValid) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    // Get form data
    const name = document.getElementById('course-name').value.trim();
    const description = document.getElementById('course-description').value.trim() || null;
    const depsSelect = document.getElementById('course-dependencies');
    const dependencies = Array.from(depsSelect.selectedOptions).map(opt => opt.value);
    
    const courseData = {
      name,
      description,
      dependencies
    };
    
    // Validate complete course object
    const validation = ValidationUtils.validateCourse({
      ...courseData,
      id: this.currentCourse?.id
    });
    
    if (!validation.valid) {
      Object.keys(validation.errors).forEach(field => {
        const errorSpan = document.getElementById(`${field}-error`);
        if (errorSpan) {
          errorSpan.textContent = validation.errors[field];
        }
      });
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    // Disable submit button and show loading state
    const originalText = this.submitBtn.textContent;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Saving...';
    this.submitBtn.style.opacity = '0.6';
    this.submitBtn.style.cursor = 'not-allowed';
    
    try {
      showLoading(true);
      
      let result;
      if (this.mode === 'create') {
        result = await apiClient.createCourse(courseData);
        toast.success('Course created successfully!');
      } else {
        result = await apiClient.updateCourse(this.currentCourse.id, courseData);
        toast.success('Course updated successfully!');
      }
      
      // Reload courses
      await loadCourses();
      
      // Close modal
      this.close();
      
    } catch (error) {
      console.error('Error saving course:', error);
      
      if (error instanceof APIError) {
        if (error.status === 409) {
          toast.error('Circular dependency detected. Please adjust the dependencies.', 0);
        } else {
          toast.error(`Failed to save course: ${error.message}`, 0);
        }
      } else {
        toast.error('Failed to save course. Please try again.', 0);
      }
    } finally {
      showLoading(false);
      
      // Re-enable submit button
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = originalText;
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.cursor = 'pointer';
    }
  }
}

// ============================================
// ValidationUtils - Form Validation
// ============================================

class ValidationUtils {
  /**
   * Validate course name
   * @param {string} name - Course name
   * @returns {Object} Validation result { valid, error }
   */
  static validateCourseName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Course name is required' };
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Course name cannot be empty or whitespace only' };
    }

    if (trimmed.length > 200) {
      return { valid: false, error: 'Course name must be 200 characters or less' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate course description
   * @param {string} description - Course description
   * @returns {Object} Validation result { valid, error }
   */
  static validateDescription(description) {
    if (description === null || description === undefined || description === '') {
      return { valid: true, error: null }; // Description is optional
    }

    if (typeof description !== 'string') {
      return { valid: false, error: 'Description must be text' };
    }

    if (description.length > 1000) {
      return { valid: false, error: 'Description must be 1000 characters or less' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate dependencies array
   * @param {Array} dependencies - Array of dependency IDs
   * @param {string} courseId - Current course ID (to prevent self-dependency)
   * @returns {Object} Validation result { valid, error }
   */
  static validateDependencies(dependencies, courseId = null) {
    if (!dependencies) {
      return { valid: true, error: null }; // Dependencies are optional
    }

    if (!Array.isArray(dependencies)) {
      return { valid: false, error: 'Dependencies must be an array' };
    }

    // Check for self-dependency
    if (courseId && dependencies.includes(courseId)) {
      return { valid: false, error: 'A course cannot depend on itself' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate entire course object
   * @param {Object} course - Course object
   * @returns {Object} Validation result { valid, errors }
   */
  static validateCourse(course) {
    const errors = {};
    let valid = true;

    const nameValidation = this.validateCourseName(course.name);
    if (!nameValidation.valid) {
      errors.name = nameValidation.error;
      valid = false;
    }

    const descValidation = this.validateDescription(course.description);
    if (!descValidation.valid) {
      errors.description = descValidation.error;
      valid = false;
    }

    const depsValidation = this.validateDependencies(course.dependencies, course.id);
    if (!depsValidation.valid) {
      errors.dependencies = depsValidation.error;
      valid = false;
    }

    return { valid, errors };
  }
}

// ============================================
// Global Application Instance
// ============================================

// Initialize global instances
const stateManager = new StateManager();
const apiClient = new APIClient();
const storageService = new StorageService();
const toast = new ToastNotification();
let courseModal = null; // Will be initialized after DOM loads
let confirmDialog = null; // Will be initialized after DOM loads

// ============================================
// Application Initialization
// ============================================

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Load saved preferences and state
    const preferences = storageService.loadPreferences();
    const completedCourses = storageService.loadCompletedCourses();
    const graphLayout = storageService.loadGraphLayout();

    // Update state with loaded data
    stateManager.setState({
      preferences,
      completedCourses,
      graphLayout,
      viewMode: preferences.viewMode || 'graph'
    });

    // Load courses from API
    await loadCourses();

    // Initialize UI components
    initializeUI();

    // Set up event listeners
    setupEventListeners();

    // Restore view mode
    switchView(stateManager.state.viewMode);

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
    toast.error('Failed to initialize application. Please refresh the page.');
  }
}

/**
 * Load courses from API
 */
async function loadCourses() {
  try {
    showLoading(true);
    const courses = await apiClient.getCourses();
    stateManager.setState({ courses });
    return courses;
  } catch (error) {
    console.error('Error loading courses:', error);
    if (error instanceof APIError) {
      toast.error(`Failed to load courses: ${error.message}`);
    } else {
      toast.error('Failed to load courses. Please check your connection.');
    }
    throw error;
  } finally {
    showLoading(false);
  }
}

/**
 * Initialize UI components
 */
function initializeUI() {
  // Initialize course modal
  courseModal = new CourseModalManager();
  
  // Initialize confirm dialog
  confirmDialog = new ConfirmDialog();
  
  console.log('UI components initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // View switching
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      switchView(view);
    });
  });

  // Add course button
  const addBtn = document.getElementById('add-course-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => openCourseModal());
  }

  // Add first course buttons in empty states
  document.querySelectorAll('.add-first-course').forEach(btn => {
    btn.addEventListener('click', () => openCourseModal());
  });

  // Set up detail panel
  setupDetailPanel();

  // Subscribe to state changes
  stateManager.subscribe(handleStateChange);
}

/**
 * Handle state changes
 * @param {Object} state - New state
 */
function handleStateChange(state) {
  // Save preferences when they change
  storageService.savePreferences(state.preferences);
  
  // Save completed courses when they change
  storageService.saveCompletedCourses(state.completedCourses);
  
  // Update progress indicator
  updateProgressIndicator(state);
  
  console.log('State updated:', state);
}

/**
 * Switch between views
 * @param {string} viewMode - View mode: 'graph', 'timeline', 'list'
 */
function switchView(viewMode) {
  // Update state
  stateManager.setState({ viewMode });

  // Update view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    const isActive = btn.dataset.view === viewMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  // Update view containers
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  const activeView = document.getElementById(`${viewMode}-view`);
  if (activeView) {
    activeView.classList.add('active');
  }

  // Save preference
  const preferences = { ...stateManager.state.preferences, viewMode };
  stateManager.setState({ preferences });
}

/**
 * Update progress indicator
 * @param {Object} state - Current state
 */
function updateProgressIndicator(state) {
  const total = state.courses.length;
  const completed = state.completedCourses.size;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');

  if (progressText) {
    progressText.textContent = `${completed} / ${total} (${percentage}%)`;
  }

  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
  }
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !show);
  }
}

/**
 * Open course modal for creating/editing
 * @param {Object} course - Course to edit (null for new course)
 */
function openCourseModal(course = null) {
  if (!courseModal) {
    console.error('Course modal not initialized');
    return;
  }
  
  if (course) {
    courseModal.openForEdit(course);
  } else {
    courseModal.openForCreate();
  }
}

/**
 * Delete a course with confirmation
 * @param {Object} course - Course to delete
 */
async function deleteCourse(course) {
  if (!confirmDialog) {
    console.error('Confirm dialog not initialized');
    return;
  }

  const confirmed = await confirmDialog.confirm(
    `Are you sure you want to delete "${course.name}"? This action cannot be undone.`,
    'Delete Course',
    'Delete',
    'Cancel'
  );

  if (!confirmed) {
    return;
  }

  try {
    showLoading(true);
    await apiClient.deleteCourse(course.id);
    toast.success('Course deleted successfully!');
    
    // Reload courses
    await loadCourses();
    
    // Close detail panel if open
    closeDetailPanel();
    
  } catch (error) {
    console.error('Error deleting course:', error);
    
    if (error instanceof APIError) {
      if (error.status === 404) {
        toast.error('Course not found. It may have already been deleted.');
        await loadCourses(); // Refresh to sync state
      } else if (error.status === 409) {
        toast.error('Cannot delete this course because other courses depend on it.', 0);
      } else {
        toast.error(`Failed to delete course: ${error.message}`, 0);
      }
    } else {
      toast.error('Failed to delete course. Please try again.', 0);
    }
  } finally {
    showLoading(false);
  }
}

/**
 * Open detail panel for a course
 * @param {Object} course - Course to display
 */
function openDetailPanel(course) {
  const panel = document.getElementById('detail-panel');
  const detailContent = document.getElementById('detail-content');
  const detailTitle = document.getElementById('detail-title');
  const editBtn = document.getElementById('detail-edit');
  const deleteBtn = document.getElementById('detail-delete');
  
  if (!panel || !detailContent || !detailTitle) {
    console.error('Detail panel elements not found');
    return;
  }

  // Update title
  detailTitle.textContent = course.name;

  // Build content
  let contentHtml = `
    <div class="detail-section">
      <h3>Description</h3>
      <p>${course.description || 'No description provided'}</p>
    </div>
  `;

  if (course.dependencies && course.dependencies.length > 0) {
    const depNames = course.dependencies
      .map(depId => {
        const dep = stateManager.state.courses.find(c => c.id === depId);
        return dep ? dep.name : 'Unknown';
      })
      .join(', ');
    
    contentHtml += `
      <div class="detail-section">
        <h3>Dependencies</h3>
        <p>${depNames}</p>
      </div>
    `;
  } else {
    contentHtml += `
      <div class="detail-section">
        <h3>Dependencies</h3>
        <p>No dependencies</p>
      </div>
    `;
  }

  // Add completion status
  const isCompleted = stateManager.isCompleted(course.id);
  const isAvailable = stateManager.isAvailable(course);
  
  let statusText = 'Locked';
  let statusClass = 'status-locked';
  
  if (isCompleted) {
    statusText = 'Completed';
    statusClass = 'status-completed';
  } else if (isAvailable) {
    statusText = 'Available';
    statusClass = 'status-available';
  }

  contentHtml += `
    <div class="detail-section">
      <h3>Status</h3>
      <p class="${statusClass}">${statusText}</p>
    </div>
  `;

  detailContent.innerHTML = contentHtml;

  // Set up edit button
  editBtn.onclick = () => {
    closeDetailPanel();
    openCourseModal(course);
  };

  // Set up delete button
  deleteBtn.onclick = () => {
    deleteCourse(course);
  };

  // Open panel
  panel.classList.add('open');
  
  // Store current course
  stateManager.setState({ selectedCourse: course });
}

/**
 * Close detail panel
 */
function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (panel) {
    panel.classList.remove('open');
  }
  stateManager.setState({ selectedCourse: null });
}

/**
 * Set up detail panel close button
 */
function setupDetailPanel() {
  const closeBtn = document.getElementById('detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailPanel);
  }
}

// ============================================
// Start Application
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
