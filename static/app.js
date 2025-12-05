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
   * @returns {Promise<void>}
   */
  async toggleCompletion(courseId) {
    const completedCourses = new Set(this.state.completedCourses);
    const wasCompleted = completedCourses.has(courseId);
    
    if (wasCompleted) {
      completedCourses.delete(courseId);
    } else {
      completedCourses.add(courseId);
    }
    
    // Update state immediately for responsive UI
    this.setState({ completedCourses });
    
    // Persist to backend API
    try {
      const course = this.state.courses.find(c => c.id === courseId);
      if (course) {
        // Add completed field to course data
        const updatedCourse = {
          ...course,
          completed: !wasCompleted
        };
        
        // Note: This assumes the backend API accepts a 'completed' field
        // If the backend doesn't support this, we would need to add an endpoint
        // For now, we'll store it in local storage as the primary persistence
        // and the backend update is optional
        
        // The completion status is already persisted via local storage
        // in the handleStateChange function through storageService.saveCompletedCourses
      }
    } catch (error) {
      console.error('Error persisting completion status:', error);
      // Revert state on error
      if (wasCompleted) {
        completedCourses.add(courseId);
      } else {
        completedCourses.delete(courseId);
      }
      this.setState({ completedCourses });
      throw error;
    }
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
    // Use the search endpoint with no query to get all resources in topological order
    return this.request('/search');
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
      },
      filters: { status: 'all' },
      searchQuery: ''
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
// GraphView - D3.js Force-Directed Graph
// ============================================

class GraphView {
  constructor(container, stateManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.graphContainer = document.getElementById('graph-container');
    this.emptyState = document.getElementById('graph-empty');
    
    // D3 elements
    this.svg = null;
    this.g = null; // Main group for zoom/pan
    this.simulation = null;
    this.nodes = [];
    this.links = [];
    
    // D3 selections
    this.nodeElements = null;
    this.linkElements = null;
    this.labelElements = null;
    
    // Zoom behavior
    this.zoom = null;
    this.currentTransform = d3.zoomIdentity;
    
    // Initialize if D3 is available
    if (typeof d3 !== 'undefined') {
      this.initialize();
    } else {
      console.error('D3.js not loaded');
    }
  }

  /**
   * Initialize the D3 graph
   */
  initialize() {
    if (!this.graphContainer) {
      console.error('Graph container not found');
      return;
    }
    
    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
      console.error('D3.js library not loaded');
      this.graphContainer.innerHTML = `
        <div class="graph-error">
          <div class="error-icon">⚠️</div>
          <h3>Graph Visualization Unavailable</h3>
          <p>The D3.js library failed to load. Please check your internet connection and refresh the page.</p>
        </div>
      `;
      return;
    }

    // Clear any existing SVG
    this.graphContainer.innerHTML = '';

    // Get container dimensions
    const rect = this.graphContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Create SVG element
    this.svg = d3.select(this.graphContainer)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, width, height])
      .attr('role', 'img')
      .attr('aria-label', 'Interactive course dependency graph');

    // Add defs for arrow markers
    const defs = this.svg.append('defs');
    
    // Arrow marker for edges
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25) // Position at edge of node
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#cbd5e1');

    // Highlighted arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead-highlight')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#ec4899');

    // Create main group for zoom/pan
    this.g = this.svg.append('g')
      .attr('class', 'graph-group');

    // Create groups for links and nodes (links first so nodes are on top)
    this.g.append('g').attr('class', 'links');
    this.g.append('g').attr('class', 'nodes');
    this.g.append('g').attr('class', 'labels');

    // Set up zoom behavior
    this.setupZoom(width, height);

    // Set up force simulation
    this.setupSimulation(width, height);

    // Set up graph controls
    this.setupControls();

    console.log('Graph view initialized');
  }

  /**
   * Set up zoom and pan behaviors
   * @param {number} width - Container width
   * @param {number} height - Container height
   */
  setupZoom(width, height) {
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4]) // Min and max zoom levels
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Center the view initially
    const initialScale = 0.8;
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initialScale);
    
    this.svg.call(this.zoom.transform, initialTransform);
    this.currentTransform = initialTransform;
  }

  /**
   * Set up force simulation
   * @param {number} width - Container width
   * @param {number} height - Container height
   */
  setupSimulation(width, height) {
    const preferences = this.stateManager.state.preferences;
    
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance(preferences.graphPhysics?.linkDistance || 150))
      .force('charge', d3.forceManyBody()
        .strength(preferences.graphPhysics?.chargeStrength || -400))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(60))
      .force('x', d3.forceX(0).strength(0.05))
      .force('y', d3.forceY(0).strength(0.05));

    // Update positions on tick
    this.simulation.on('tick', () => this.ticked());
  }

  /**
   * Set up graph control buttons
   */
  setupControls() {
    const resetBtn = document.getElementById('graph-reset');
    const zoomInBtn = document.getElementById('graph-zoom-in');
    const zoomOutBtn = document.getElementById('graph-zoom-out');

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetView());
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn());
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut());
    }
  }

  /**
   * Reset view to initial position and zoom
   */
  resetView() {
    if (!this.svg || !this.zoom) return;

    const rect = this.graphContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const initialScale = 0.8;
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initialScale);

    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, initialTransform);
  }

  /**
   * Zoom in
   */
  zoomIn() {
    if (!this.svg || !this.zoom) return;

    this.svg.transition()
      .duration(300)
      .call(this.zoom.scaleBy, 1.3);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    if (!this.svg || !this.zoom) return;

    this.svg.transition()
      .duration(300)
      .call(this.zoom.scaleBy, 0.7);
  }

  /**
   * Update the graph with courses
   * @param {Array} courses - Array of courses to display
   */
  update(courses) {
    if (!this.graphContainer || !this.emptyState) {
      console.error('Graph view elements not found');
      return;
    }

    // Apply filters and search to ensure synchronization with other views
    const filteredCourses = this.filterCourses(courses);

    // Show empty state if no courses after filtering
    if (!filteredCourses || filteredCourses.length === 0) {
      this.emptyState.classList.remove('hidden');
      if (this.svg) {
        this.svg.style('display', 'none');
      }
      return;
    }

    // Hide empty state
    this.emptyState.classList.add('hidden');
    if (this.svg) {
      this.svg.style('display', 'block');
    }

    // Prepare data
    this.prepareData(filteredCourses);

    // Render the graph
    this.render();
  }

  /**
   * Filter courses based on search query and filters
   * This ensures the graph view displays the same filtered courses as other views
   * @param {Array} courses - Array of courses
   * @returns {Array} Filtered courses
   */
  filterCourses(courses) {
    let filtered = [...courses];

    // Apply search filter
    const searchQuery = this.stateManager.state.searchQuery.toLowerCase().trim();
    if (searchQuery) {
      filtered = filtered.filter(course => {
        const nameMatch = course.name.toLowerCase().includes(searchQuery);
        const descMatch = course.description && course.description.toLowerCase().includes(searchQuery);
        return nameMatch || descMatch;
      });
    }

    // Apply status filter
    const statusFilter = this.stateManager.state.filters.status;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => {
        const isCompleted = this.stateManager.isCompleted(course.id);
        const isAvailable = this.stateManager.isAvailable(course);

        if (statusFilter === 'completed') {
          return isCompleted;
        } else if (statusFilter === 'available') {
          return !isCompleted && isAvailable;
        } else if (statusFilter === 'locked') {
          return !isCompleted && !isAvailable;
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * Prepare nodes and links data from courses
   * @param {Array} courses - Array of courses
   */
  prepareData(courses) {
    // Create nodes
    this.nodes = courses.map(course => {
      const isCompleted = this.stateManager.isCompleted(course.id);
      const isAvailable = this.stateManager.isAvailable(course);
      
      // Get saved position if exists
      const savedLayout = this.stateManager.state.graphLayout;
      const savedPos = savedLayout[course.id];
      
      return {
        id: course.id,
        name: course.name,
        description: course.description,
        dependencies: course.dependencies || [],
        completed: isCompleted,
        available: isAvailable,
        x: savedPos?.x,
        y: savedPos?.y
      };
    });

    // Create links
    this.links = [];
    courses.forEach(course => {
      if (course.dependencies && Array.isArray(course.dependencies)) {
        course.dependencies.forEach(depId => {
          this.links.push({
            source: depId,
            target: course.id
          });
        });
      }
    });
  }

  /**
   * Render the graph using D3
   */
  render() {
    // Update simulation with new data
    this.simulation.nodes(this.nodes);
    this.simulation.force('link').links(this.links);

    // Render links (edges)
    this.renderLinks();

    // Render nodes
    this.renderNodes();

    // Render labels
    this.renderLabels();

    // Restart simulation
    this.simulation.alpha(1).restart();
  }

  /**
   * Render graph links (edges)
   */
  renderLinks() {
    const linksGroup = this.g.select('.links');

    // Bind data with key function for proper enter/update/exit
    this.linkElements = linksGroup.selectAll('line.link')
      .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    // EXIT: Remove old links with fade-out
    this.linkElements.exit()
      .transition()
      .duration(400)
      .ease(d3.easeCubicIn)
      .style('opacity', 0)
      .attr('stroke-width', 0)
      .remove();

    // ENTER: Create new links
    const linkEnter = this.linkElements.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)')
      .style('opacity', 0);

    // UPDATE + ENTER: Merge selections
    this.linkElements = linkEnter.merge(this.linkElements);

    // Fade in new links with smooth easing
    this.linkElements
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .style('opacity', 1)
      .attr('stroke-opacity', 0.6);

    // Update link colors based on source/target status
    this.linkElements
      .attr('stroke', d => {
        const sourceNode = this.nodes.find(n => n.id === (d.source.id || d.source));
        const targetNode = this.nodes.find(n => n.id === (d.target.id || d.target));
        
        // If both nodes are completed, make the edge more prominent
        if (sourceNode?.completed && targetNode?.completed) {
          return '#a5b4fc'; // Light blue for completed path
        }
        // If source is completed but target is not, show as available path
        if (sourceNode?.completed && targetNode?.available) {
          return '#6ee7b7'; // Light green for available path
        }
        // Default gray
        return '#cbd5e1';
      })
      .attr('stroke-width', d => {
        const sourceNode = this.nodes.find(n => n.id === (d.source.id || d.source));
        const targetNode = this.nodes.find(n => n.id === (d.target.id || d.target));
        
        // Make completed paths slightly thicker
        if (sourceNode?.completed && targetNode?.completed) {
          return 2.5;
        }
        return 2;
      });
  }

  /**
   * Render graph nodes
   */
  renderNodes() {
    const nodesGroup = this.g.select('.nodes');

    // Bind data with key function for proper enter/update/exit
    this.nodeElements = nodesGroup.selectAll('g.node')
      .data(this.nodes, d => d.id);

    // EXIT: Remove old nodes with fade-out animation
    this.nodeElements.exit()
      .transition()
      .duration(400)
      .ease(d3.easeCubicIn)
      .style('opacity', 0)
      .attr('transform', d => `translate(${d.x},${d.y}) scale(0.1)`)
      .remove();

    // ENTER: Create new nodes
    const nodeEnter = this.nodeElements.enter()
      .append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .style('opacity', 0);

    // Add circle with shadow and border
    nodeEnter.append('circle')
      .attr('r', 20)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .style('transition', 'all 0.2s ease');

    // Add inner circle for completed checkmark
    nodeEnter.append('circle')
      .attr('class', 'checkmark-bg')
      .attr('r', 8)
      .attr('fill', '#fff')
      .style('opacity', 0);

    // Add checkmark path for completed courses
    nodeEnter.append('path')
      .attr('class', 'checkmark')
      .attr('d', 'M-4,0 L-1,3 L4,-3')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .style('opacity', 0);

    // UPDATE + ENTER: Merge selections
    this.nodeElements = nodeEnter.merge(this.nodeElements);

    // Update node colors based on status with smooth transitions
    this.nodeElements.select('circle:first-child')
      .transition()
      .duration(400)
      .ease(d3.easeCubicInOut)
      .attr('fill', d => {
        if (d.completed) return '#6366f1'; // Completed - primary blue
        if (d.available) return '#10b981'; // Available - green
        return '#9ca3af'; // Locked - gray
      })
      .attr('stroke', d => {
        if (d.completed) return '#4f46e5'; // Darker blue border
        if (d.available) return '#059669'; // Darker green border
        return '#6b7280'; // Darker gray border
      });

    // Show/hide checkmark for completed courses with scale animation
    this.nodeElements.select('.checkmark-bg')
      .transition()
      .duration(300)
      .ease(d3.easeBackOut)
      .style('opacity', d => d.completed ? 1 : 0)
      .attr('r', d => d.completed ? 8 : 4);

    this.nodeElements.select('.checkmark')
      .transition()
      .duration(300)
      .ease(d3.easeBackOut)
      .style('opacity', d => d.completed ? 1 : 0);

    // Fade in new nodes with scale animation and bounce effect
    nodeEnter
      .attr('transform', d => `translate(${d.x || 0},${d.y || 0}) scale(0.1)`)
      .transition()
      .duration(500)
      .ease(d3.easeElasticOut.amplitude(1).period(0.5))
      .style('opacity', 1)
      .attr('transform', d => `translate(${d.x || 0},${d.y || 0}) scale(1)`);

    // Set up drag behavior
    const drag = d3.drag()
      .on('start', (event, d) => this.dragStarted(event, d))
      .on('drag', (event, d) => this.dragged(event, d))
      .on('end', (event, d) => this.dragEnded(event, d));

    this.nodeElements.call(drag);

    // Set up hover interactions
    this.nodeElements
      .on('mouseenter', (event, d) => this.handleNodeHover(event, d, true))
      .on('mouseleave', (event, d) => this.handleNodeHover(event, d, false))
      .on('click', (event, d) => this.handleNodeClick(event, d));

    // Add ARIA labels for accessibility
    this.nodeElements
      .attr('role', 'button')
      .attr('aria-label', d => {
        const status = d.completed ? 'Completed' : d.available ? 'Available' : 'Locked';
        const depCount = d.dependencies.length;
        const depText = depCount > 0 ? `, ${depCount} ${depCount === 1 ? 'dependency' : 'dependencies'}` : '';
        return `${d.name} - ${status}${depText}`;
      })
      .attr('tabindex', 0)
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.handleNodeClick(event, d);
        }
      });
  }

  /**
   * Render node labels
   */
  renderLabels() {
    const labelsGroup = this.g.select('.labels');

    // Bind data
    this.labelElements = labelsGroup.selectAll('text')
      .data(this.nodes, d => d.id);

    // Exit
    this.labelElements.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();

    // Enter
    const labelEnter = this.labelElements.enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 35)
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
      .style('opacity', 0);

    // Update + Enter
    this.labelElements = labelEnter.merge(this.labelElements);

    this.labelElements
      .text(d => {
        // Truncate long names
        const maxLength = 15;
        return d.name.length > maxLength ? d.name.substring(0, maxLength) + '...' : d.name;
      })
      .transition()
      .duration(300)
      .style('opacity', 1);
  }

  /**
   * Update positions on simulation tick
   */
  ticked() {
    // Update link positions
    if (this.linkElements) {
      this.linkElements
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    }

    // Update node positions
    if (this.nodeElements) {
      this.nodeElements
        .attr('transform', d => `translate(${d.x},${d.y})`);
    }

    // Update label positions
    if (this.labelElements) {
      this.labelElements
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    }
  }

  /**
   * Handle drag start
   */
  dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    
    // Add visual feedback
    d3.select(event.sourceEvent.target.parentNode)
      .select('circle:first-child')
      .transition()
      .duration(100)
      .attr('r', 24)
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))');
  }

  /**
   * Handle dragging - maintain edge connections
   */
  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    
    // The simulation tick will automatically update edge positions
    // because we're updating the node's fx and fy properties
  }

  /**
   * Handle drag end - save position to local storage
   */
  dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    
    // Keep the node fixed at the dragged position
    // (Don't release fx/fy so the node stays where the user put it)
    
    // Save the new position to local storage
    this.saveNodePosition(d);
    
    // Reset visual feedback
    d3.select(event.sourceEvent.target.parentNode)
      .select('circle:first-child')
      .transition()
      .duration(100)
      .attr('r', 20)
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))');
  }

  /**
   * Save node position to local storage
   * @param {Object} node - Node with updated position
   */
  saveNodePosition(node) {
    const graphLayout = { ...this.stateManager.state.graphLayout };
    graphLayout[node.id] = {
      x: node.fx,
      y: node.fy
    };
    
    // Update state and save to storage
    this.stateManager.setState({ graphLayout });
    storageService.saveGraphLayout(graphLayout);
  }

  /**
   * Handle node hover with highlighting
   * Highlights the hovered node, its dependencies (incoming), and dependents (outgoing)
   */
  handleNodeHover(event, d, isEntering) {
    const node = d3.select(event.currentTarget);
    
    // Trigger cross-view synchronization with timeline view
    if (timelineView && typeof timelineView.highlightCourseExternal === 'function') {
      timelineView.highlightCourseExternal(d.id, isEntering);
    }
    
    if (isEntering) {
      // Enlarge the hovered node
      node.select('circle:first-child')
        .transition()
        .duration(150)
        .attr('r', 24)
        .attr('stroke-width', 3);

      // Find related nodes
      const dependencies = new Set(); // Nodes this course depends on (incoming edges)
      const dependents = new Set(); // Nodes that depend on this course (outgoing edges)

      // Find dependencies (incoming edges - sources)
      this.links.forEach(link => {
        const targetId = link.target.id || link.target;
        const sourceId = link.source.id || link.source;
        
        if (targetId === d.id) {
          dependencies.add(sourceId);
        }
        if (sourceId === d.id) {
          dependents.add(targetId);
        }
      });

      // Dim all nodes first
      this.nodeElements
        .transition()
        .duration(150)
        .style('opacity', node => {
          if (node.id === d.id) return 1; // Keep hovered node fully visible
          if (dependencies.has(node.id) || dependents.has(node.id)) return 1; // Keep related nodes visible
          return 0.3; // Dim unrelated nodes
        });

      // Highlight related nodes
      this.nodeElements
        .filter(node => dependencies.has(node.id))
        .select('circle:first-child')
        .transition()
        .duration(150)
        .attr('stroke', '#ec4899') // Pink for dependencies
        .attr('stroke-width', 3);

      this.nodeElements
        .filter(node => dependents.has(node.id))
        .select('circle:first-child')
        .transition()
        .duration(150)
        .attr('stroke', '#8b5cf6') // Purple for dependents
        .attr('stroke-width', 3);

      // Dim all links first
      this.linkElements
        .transition()
        .duration(150)
        .style('opacity', 0.1);

      // Highlight incoming edges (dependencies)
      this.linkElements
        .filter(link => {
          const targetId = link.target.id || link.target;
          return targetId === d.id;
        })
        .transition()
        .duration(150)
        .style('opacity', 1)
        .attr('stroke', '#ec4899')
        .attr('stroke-width', 3)
        .attr('marker-end', 'url(#arrowhead-highlight)');

      // Highlight outgoing edges (dependents)
      this.linkElements
        .filter(link => {
          const sourceId = link.source.id || link.source;
          return sourceId === d.id;
        })
        .transition()
        .duration(150)
        .style('opacity', 1)
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', 3)
        .attr('marker-end', 'url(#arrowhead-highlight)');

    } else {
      // Reset hovered node size
      node.select('circle:first-child')
        .transition()
        .duration(150)
        .attr('r', 20)
        .attr('stroke-width', 2);

      // Reset all nodes opacity
      this.nodeElements
        .transition()
        .duration(150)
        .style('opacity', 1);

      // Reset all node strokes to their original colors
      this.nodeElements.select('circle:first-child')
        .transition()
        .duration(150)
        .attr('stroke', node => {
          if (node.completed) return '#4f46e5';
          if (node.available) return '#059669';
          return '#6b7280';
        })
        .attr('stroke-width', 2);

      // Reset all links
      this.linkElements
        .transition()
        .duration(150)
        .style('opacity', 1)
        .attr('stroke', link => {
          const sourceNode = this.nodes.find(n => n.id === (link.source.id || link.source));
          const targetNode = this.nodes.find(n => n.id === (link.target.id || link.target));
          
          if (sourceNode?.completed && targetNode?.completed) {
            return '#a5b4fc';
          }
          if (sourceNode?.completed && targetNode?.available) {
            return '#6ee7b7';
          }
          return '#cbd5e1';
        })
        .attr('stroke-width', link => {
          const sourceNode = this.nodes.find(n => n.id === (link.source.id || link.source));
          const targetNode = this.nodes.find(n => n.id === (link.target.id || link.target));
          
          if (sourceNode?.completed && targetNode?.completed) {
            return 2.5;
          }
          return 2;
        })
        .attr('marker-end', 'url(#arrowhead)');
    }
  }

  /**
   * Handle node click - center view and open detail panel
   */
  handleNodeClick(event, d) {
    event.stopPropagation();
    
    // Center view on clicked node with smooth animation
    this.centerOnNode(d);
    
    // Open detail panel with course information
    const course = this.stateManager.state.courses.find(c => c.id === d.id);
    if (course) {
      openDetailPanel(course);
    }
  }

  /**
   * Center the view on a specific node with smooth animation
   * @param {Object} node - Node to center on
   */
  centerOnNode(node) {
    if (!this.svg || !this.zoom) return;

    const rect = this.graphContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate the transform to center the node
    const scale = 1.2; // Zoom in slightly when centering
    const x = width / 2 - node.x * scale;
    const y = height / 2 - node.y * scale;

    const transform = d3.zoomIdentity
      .translate(x, y)
      .scale(scale);

    // Animate to the new transform
    this.svg.transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .call(this.zoom.transform, transform);
  }

  /**
   * Highlight a node externally (for cross-view synchronization)
   * @param {string} courseId - Course ID to highlight
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightNodeExternal(courseId, highlight) {
    if (!this.nodeElements) return;

    // Find the node with this course ID
    const node = this.nodes.find(n => n.id === courseId);
    if (!node) return;

    // Find the D3 selection for this node
    const nodeSelection = this.nodeElements.filter(d => d.id === courseId);
    
    if (highlight) {
      // Enlarge the node
      nodeSelection.select('circle:first-child')
        .transition()
        .duration(150)
        .attr('r', 24)
        .attr('stroke-width', 3)
        .attr('stroke', '#ec4899'); // Pink highlight for cross-view

      // Find related nodes
      const dependencies = new Set();
      const dependents = new Set();

      this.links.forEach(link => {
        const targetId = link.target.id || link.target;
        const sourceId = link.source.id || link.source;
        
        if (targetId === courseId) {
          dependencies.add(sourceId);
        }
        if (sourceId === courseId) {
          dependents.add(targetId);
        }
      });

      // Dim unrelated nodes
      this.nodeElements
        .transition()
        .duration(150)
        .style('opacity', n => {
          if (n.id === courseId) return 1;
          if (dependencies.has(n.id) || dependents.has(n.id)) return 1;
          return 0.3;
        });

      // Highlight related edges
      if (this.linkElements) {
        this.linkElements
          .transition()
          .duration(150)
          .style('opacity', link => {
            const targetId = link.target.id || link.target;
            const sourceId = link.source.id || link.source;
            return (targetId === courseId || sourceId === courseId) ? 1 : 0.1;
          })
          .attr('stroke', link => {
            const targetId = link.target.id || link.target;
            const sourceId = link.source.id || link.source;
            if (targetId === courseId) return '#ec4899';
            if (sourceId === courseId) return '#8b5cf6';
            return '#cbd5e1';
          });
      }
    } else {
      // Reset node
      nodeSelection.select('circle:first-child')
        .transition()
        .duration(150)
        .attr('r', 20)
        .attr('stroke-width', 2)
        .attr('stroke', n => {
          if (n.completed) return '#4f46e5';
          if (n.available) return '#059669';
          return '#6b7280';
        });

      // Reset all nodes opacity
      this.nodeElements
        .transition()
        .duration(150)
        .style('opacity', 1);

      // Reset all links
      if (this.linkElements) {
        this.linkElements
          .transition()
          .duration(150)
          .style('opacity', 1)
          .attr('stroke', link => {
            const sourceNode = this.nodes.find(n => n.id === (link.source.id || link.source));
            const targetNode = this.nodes.find(n => n.id === (link.target.id || link.target));
            
            if (sourceNode?.completed && targetNode?.completed) {
              return '#a5b4fc';
            }
            if (sourceNode?.completed && targetNode?.available) {
              return '#6ee7b7';
            }
            return '#cbd5e1';
          });
      }
    }
  }
}

// ============================================
// ListView - List View Component
// ============================================

class ListView {
  constructor(container, stateManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.listContainer = document.getElementById('list-container');
    this.emptyState = document.getElementById('list-empty');
  }

  /**
   * Update the list view with courses
   * @param {Array} courses - Array of courses to display
   */
  update(courses) {
    if (!this.listContainer || !this.emptyState) {
      console.error('List view elements not found');
      return;
    }

    // Apply filters and search
    const filteredCourses = this.filterCourses(courses);

    // Show empty state if no courses
    if (filteredCourses.length === 0) {
      this.listContainer.innerHTML = '';
      this.emptyState.classList.remove('hidden');
      return;
    }

    // Hide empty state
    this.emptyState.classList.add('hidden');

    // Render course cards
    this.render(filteredCourses);
  }

  /**
   * Filter courses based on search query and filters
   * @param {Array} courses - Array of courses
   * @returns {Array} Filtered courses
   */
  filterCourses(courses) {
    let filtered = [...courses];

    // Apply search filter
    const searchQuery = this.stateManager.state.searchQuery.toLowerCase().trim();
    if (searchQuery) {
      filtered = filtered.filter(course => {
        const nameMatch = course.name.toLowerCase().includes(searchQuery);
        const descMatch = course.description && course.description.toLowerCase().includes(searchQuery);
        return nameMatch || descMatch;
      });
    }

    // Apply status filter
    const statusFilter = this.stateManager.state.filters.status;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => {
        const isCompleted = this.stateManager.isCompleted(course.id);
        const isAvailable = this.stateManager.isAvailable(course);

        if (statusFilter === 'completed') {
          return isCompleted;
        } else if (statusFilter === 'available') {
          return !isCompleted && isAvailable;
        } else if (statusFilter === 'locked') {
          return !isCompleted && !isAvailable;
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * Render course cards
   * @param {Array} courses - Array of courses to render
   */
  render(courses) {
    this.listContainer.innerHTML = '';

    courses.forEach(course => {
      const card = this.createCourseCard(course);
      this.listContainer.appendChild(card);
    });
  }

  /**
   * Create a course card element
   * @param {Object} course - Course object
   * @returns {HTMLElement} Course card element
   */
  createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    
    // Determine course status
    const isCompleted = this.stateManager.isCompleted(course.id);
    const isAvailable = this.stateManager.isAvailable(course);
    
    if (isCompleted) {
      card.classList.add('completed');
    } else if (isAvailable) {
      card.classList.add('available');
    } else {
      card.classList.add('locked');
    }

    // Add status indicator
    let statusIndicator = '';
    if (isCompleted) {
      statusIndicator = '<span class="status-badge completed" aria-label="Completed">✓ Completed</span>';
    } else if (isAvailable) {
      statusIndicator = '<span class="status-badge available" aria-label="Available">● Available</span>';
    } else {
      statusIndicator = '<span class="status-badge locked" aria-label="Locked">🔒 Locked</span>';
    }

    // Build dependencies list
    let dependenciesHtml = '';
    if (course.dependencies && course.dependencies.length > 0) {
      const depNames = course.dependencies
        .map(depId => {
          const dep = this.stateManager.state.courses.find(c => c.id === depId);
          return dep ? dep.name : 'Unknown';
        });
      
      dependenciesHtml = `
        <div class="course-card-footer">
          <div class="course-card-dependencies-label">Dependencies:</div>
          <div class="course-card-dependencies">
            ${depNames.map(name => `<span class="dependency-tag">${this.escapeHtml(name)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    // Highlight search matches
    const searchQuery = this.stateManager.state.searchQuery.trim();
    const displayName = searchQuery ? this.highlightText(course.name, searchQuery) : this.escapeHtml(course.name);
    const displayDesc = course.description 
      ? (searchQuery ? this.highlightText(course.description, searchQuery) : this.escapeHtml(course.description))
      : '<em>No description</em>';

    card.innerHTML = `
      <div class="course-card-header">
        <div class="course-card-title-wrapper">
          <h3 class="course-card-title">${displayName}</h3>
          ${statusIndicator}
        </div>
        <input 
          type="checkbox" 
          class="course-card-checkbox" 
          ${isCompleted ? 'checked' : ''}
          aria-label="Mark ${this.escapeHtml(course.name)} as ${isCompleted ? 'incomplete' : 'complete'}"
          data-course-id="${course.id}">
      </div>
      <div class="course-card-body">
        <p class="course-card-description">${displayDesc}</p>
      </div>
      ${dependenciesHtml}
    `;

    // Add click handler to open detail panel (but not on checkbox)
    card.addEventListener('click', (e) => {
      // Don't open panel if clicking checkbox
      if (e.target.classList.contains('course-card-checkbox')) {
        return;
      }
      openDetailPanel(course);
    });

    // Add checkbox handler
    const checkbox = card.querySelector('.course-card-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click
      this.toggleCompletion(course.id);
    });

    // Add keyboard support
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${course.name} course card. ${isCompleted ? 'Completed' : isAvailable ? 'Available' : 'Locked'}`);
    
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetailPanel(course);
      }
    });

    return card;
  }

  /**
   * Toggle course completion status
   * @param {string} courseId - Course ID
   */
  async toggleCompletion(courseId) {
    try {
      await this.stateManager.toggleCompletion(courseId);
      
      // Re-render to update card status
      this.update(this.stateManager.state.courses);
    } catch (error) {
      console.error('Error toggling completion:', error);
      // The state has already been reverted in StateManager
      // Just re-render to show the correct state
      this.update(this.stateManager.state.courses);
    }
  }

  /**
   * Highlight matching text in search results
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @returns {string} HTML with highlighted text
   */
  highlightText(text, query) {
    if (!query || !text) return this.escapeHtml(text);
    
    const escapedText = this.escapeHtml(text);
    const escapedQuery = this.escapeHtml(query);
    
    // Case-insensitive replace
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
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
}

// ============================================
// TimelineView - Timeline View Component
// ============================================

class TimelineView {
  constructor(container, stateManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.timelineContainer = document.getElementById('timeline-container');
    this.emptyState = document.getElementById('timeline-empty');
    this.sortedCourses = [];
    this.levels = [];
  }

  /**
   * Update the timeline view with courses
   * @param {Array} courses - Array of courses to display
   */
  async update(courses) {
    if (!this.timelineContainer || !this.emptyState) {
      console.error('Timeline view elements not found');
      return;
    }

    // Apply filters and search
    const filteredCourses = this.filterCourses(courses);

    // Show empty state if no courses
    if (filteredCourses.length === 0) {
      this.timelineContainer.innerHTML = '';
      this.emptyState.classList.remove('hidden');
      return;
    }

    // Hide empty state
    this.emptyState.classList.add('hidden');

    try {
      // Fetch topologically sorted courses from backend
      await this.fetchSortedCourses();
      
      // Group courses into levels
      this.groupIntoLevels();
      
      // Render the timeline
      this.render();
    } catch (error) {
      console.error('Error updating timeline view:', error);
      
      // Show error in timeline
      this.timelineContainer.innerHTML = `
        <div class="timeline-error">
          <div class="empty-icon">⚠️</div>
          <h3>Unable to Load Timeline</h3>
          <p>${error.message || 'An error occurred while loading the timeline.'}</p>
        </div>
      `;
    }
  }

  /**
   * Filter courses based on search query and filters
   * @param {Array} courses - Array of courses
   * @returns {Array} Filtered courses
   */
  filterCourses(courses) {
    let filtered = [...courses];

    // Apply search filter
    const searchQuery = this.stateManager.state.searchQuery.toLowerCase().trim();
    if (searchQuery) {
      filtered = filtered.filter(course => {
        const nameMatch = course.name.toLowerCase().includes(searchQuery);
        const descMatch = course.description && course.description.toLowerCase().includes(searchQuery);
        return nameMatch || descMatch;
      });
    }

    // Apply status filter
    const statusFilter = this.stateManager.state.filters.status;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => {
        const isCompleted = this.stateManager.isCompleted(course.id);
        const isAvailable = this.stateManager.isAvailable(course);

        if (statusFilter === 'completed') {
          return isCompleted;
        } else if (statusFilter === 'available') {
          return !isCompleted && isAvailable;
        } else if (statusFilter === 'locked') {
          return !isCompleted && !isAvailable;
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * Fetch topologically sorted courses from backend API
   */
  async fetchSortedCourses() {
    try {
      this.sortedCourses = await apiClient.getTopologicalSort();
    } catch (error) {
      console.error('Error fetching sorted courses:', error);
      
      if (error instanceof APIError && error.status === 409) {
        // Circular dependency detected
        // Extract cycle information from error details if available
        const cycleInfo = error.details?.cycle || [];
        this.displayCircularDependencyError(cycleInfo);
        throw error; // Re-throw to be caught by update()
      }
      
      throw new Error('Failed to load course timeline. Please try again.');
    }
  }

  /**
   * Display circular dependency error with affected courses
   * @param {Array} cycle - Array of course IDs in the cycle
   */
  displayCircularDependencyError(cycle) {
    if (!this.timelineContainer) return;

    // Get course names for the cycle
    const cycleNames = cycle.map(courseId => {
      const course = this.stateManager.state.courses.find(c => c.id === courseId);
      return course ? course.name : courseId;
    });

    const cycleText = cycleNames.length > 0 
      ? `<p class="cycle-courses">Affected courses: <strong>${cycleNames.join(' → ')}</strong></p>`
      : '';

    this.timelineContainer.innerHTML = `
      <div class="timeline-error circular-dependency-error">
        <div class="error-icon pulsing">⚠️</div>
        <h3>Circular Dependency Detected</h3>
        <p>A circular dependency has been detected in your course structure. This means some courses depend on each other in a loop, making it impossible to determine a valid learning order.</p>
        ${cycleText}
        <p class="error-help">Please edit the course dependencies to break the cycle.</p>
      </div>
    `;

    // Highlight the cycle nodes in the graph view if available
    if (graphView && cycle.length > 0) {
      this.highlightCycleInGraph(cycle);
    }

    // Show error toast
    toast.error('Circular dependency detected. Please fix the course dependencies to view the timeline.', 0);
  }

  /**
   * Highlight cycle nodes in the graph view
   * @param {Array} cycle - Array of course IDs in the cycle
   */
  highlightCycleInGraph(cycle) {
    if (!graphView || !graphView.nodeElements) return;

    // Add pulsing animation to cycle nodes
    cycle.forEach(courseId => {
      if (graphView.nodeElements) {
        const nodeSelection = graphView.nodeElements.filter(d => d.id === courseId);
        
        nodeSelection.select('circle:first-child')
          .attr('stroke', '#ef4444') // Red for error
          .attr('stroke-width', 3)
          .style('animation', 'pulse 2s ease-in-out infinite');
      }
    });

    // Highlight edges between cycle nodes
    if (graphView.linkElements) {
      graphView.linkElements
        .filter(link => {
          const sourceId = link.source.id || link.source;
          const targetId = link.target.id || link.target;
          return cycle.includes(sourceId) && cycle.includes(targetId);
        })
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 3)
        .style('opacity', 1);
    }
  }

  /**
   * Group courses into levels based on dependencies
   * Each level contains courses that can be taken in parallel
   */
  groupIntoLevels() {
    this.levels = [];
    const processed = new Map(); // Map of course ID to level number
    
    // Process courses in topological order
    this.sortedCourses.forEach(course => {
      const level = this.calculateLevel(course, processed);
      
      // Add course to the appropriate level
      if (!this.levels[level]) {
        this.levels[level] = [];
      }
      this.levels[level].push(course);
      
      // Mark as processed
      processed.set(course.id, level);
    });
  }

  /**
   * Calculate the level for a course based on its dependencies
   * @param {Object} course - Course object
   * @param {Map} processed - Map of processed courses to their levels
   * @returns {number} Level number (0-indexed)
   */
  calculateLevel(course, processed) {
    // If no dependencies, it's at level 0
    if (!course.dependencies || course.dependencies.length === 0) {
      return 0;
    }
    
    // Find the maximum level of all dependencies
    let maxDepLevel = -1;
    course.dependencies.forEach(depId => {
      if (processed.has(depId)) {
        const depLevel = processed.get(depId);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }
    });
    
    // This course is one level after its highest dependency
    return maxDepLevel + 1;
  }

  /**
   * Render the timeline with all levels
   */
  render() {
    this.timelineContainer.innerHTML = '';
    
    // Render each level
    this.levels.forEach((levelCourses, levelIndex) => {
      const levelElement = this.createLevelElement(levelCourses, levelIndex);
      this.timelineContainer.appendChild(levelElement);
    });
  }

  /**
   * Create a level element with its courses
   * @param {Array} courses - Courses in this level
   * @param {number} levelIndex - Level index (0-indexed)
   * @returns {HTMLElement} Level element
   */
  createLevelElement(courses, levelIndex) {
    const levelDiv = document.createElement('div');
    levelDiv.className = 'timeline-level';
    levelDiv.setAttribute('data-level', levelIndex);
    
    // Create level header
    const header = document.createElement('div');
    header.className = 'timeline-level-header';
    header.innerHTML = `
      <span class="timeline-level-number">Level ${levelIndex + 1}</span>
      <span class="timeline-level-info">${courses.length} ${courses.length === 1 ? 'course' : 'courses'}</span>
    `;
    levelDiv.appendChild(header);
    
    // Create courses container
    const coursesContainer = document.createElement('div');
    coursesContainer.className = 'timeline-courses';
    
    // Add course cards
    courses.forEach(course => {
      const card = this.createTimelineCourseCard(course);
      coursesContainer.appendChild(card);
    });
    
    levelDiv.appendChild(coursesContainer);
    
    return levelDiv;
  }

  /**
   * Create a timeline course card
   * @param {Object} course - Course object
   * @returns {HTMLElement} Course card element
   */
  createTimelineCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'timeline-course-card';
    card.setAttribute('data-course-id', course.id);
    
    // Determine course status
    const isCompleted = this.stateManager.isCompleted(course.id);
    const isAvailable = this.stateManager.isAvailable(course);
    
    if (isCompleted) {
      card.classList.add('completed');
    } else if (isAvailable) {
      card.classList.add('available');
    } else {
      card.classList.add('locked');
    }

    // Add status indicator
    let statusIndicator = '';
    if (isCompleted) {
      statusIndicator = '<span class="status-badge completed" aria-label="Completed">✓ Completed</span>';
    } else if (isAvailable) {
      statusIndicator = '<span class="status-badge available" aria-label="Available">● Available</span>';
    } else {
      statusIndicator = '<span class="status-badge locked" aria-label="Locked">🔒 Locked</span>';
    }

    // Highlight search matches
    const searchQuery = this.stateManager.state.searchQuery.trim();
    const displayName = searchQuery ? this.highlightText(course.name, searchQuery) : this.escapeHtml(course.name);
    const displayDesc = course.description 
      ? (searchQuery ? this.highlightText(course.description, searchQuery) : this.escapeHtml(course.description))
      : '<em>No description</em>';

    card.innerHTML = `
      <div class="timeline-card-header">
        <div class="timeline-card-title-wrapper">
          <h4 class="timeline-card-title">${displayName}</h4>
          ${statusIndicator}
        </div>
        <input 
          type="checkbox" 
          class="timeline-card-checkbox" 
          ${isCompleted ? 'checked' : ''}
          aria-label="Mark ${this.escapeHtml(course.name)} as ${isCompleted ? 'incomplete' : 'complete'}"
          data-course-id="${course.id}">
      </div>
      <div class="timeline-card-body">
        <p class="timeline-card-description">${displayDesc}</p>
      </div>
    `;

    // Add click handler to open detail panel (but not on checkbox)
    card.addEventListener('click', (e) => {
      // Don't open panel if clicking checkbox
      if (e.target.classList.contains('timeline-card-checkbox')) {
        return;
      }
      openDetailPanel(course);
    });

    // Add checkbox handler
    const checkbox = card.querySelector('.timeline-card-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click
      this.toggleCompletion(course.id);
    });

    // Add hover effect for cross-view synchronization
    card.addEventListener('mouseenter', () => {
      this.highlightCourse(course.id, true);
    });
    
    card.addEventListener('mouseleave', () => {
      this.highlightCourse(course.id, false);
    });

    // Add keyboard support
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${course.name} course card. ${isCompleted ? 'Completed' : isAvailable ? 'Available' : 'Locked'}`);
    
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetailPanel(course);
      }
    });

    return card;
  }

  /**
   * Toggle course completion status
   * @param {string} courseId - Course ID
   */
  async toggleCompletion(courseId) {
    try {
      await this.stateManager.toggleCompletion(courseId);
      
      // Re-render to update card status
      await this.update(this.stateManager.state.courses);
    } catch (error) {
      console.error('Error toggling completion:', error);
      // The state has already been reverted in StateManager
      // Just re-render to show the correct state
      await this.update(this.stateManager.state.courses);
    }
  }

  /**
   * Highlight a course (for cross-view synchronization)
   * @param {string} courseId - Course ID to highlight
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightCourse(courseId, highlight) {
    // Find the card for this course
    const card = this.timelineContainer.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
      card.classList.toggle('highlighted', highlight);
    }
    
    // Also trigger highlight in graph view if it exists
    // This enables cross-view synchronization
    if (graphView && typeof graphView.highlightNodeExternal === 'function') {
      graphView.highlightNodeExternal(courseId, highlight);
    }
  }

  /**
   * Highlight a course externally (for cross-view synchronization from graph)
   * @param {string} courseId - Course ID to highlight
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightCourseExternal(courseId, highlight) {
    // Find the card for this course
    const card = this.timelineContainer.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
      card.classList.toggle('highlighted', highlight);
      
      // Scroll the card into view if highlighting
      if (highlight) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /**
   * Highlight matching text in search results
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @returns {string} HTML with highlighted text
   */
  highlightText(text, query) {
    if (!query || !text) return this.escapeHtml(text);
    
    const escapedText = this.escapeHtml(text);
    const escapedQuery = this.escapeHtml(query);
    
    // Case-insensitive replace
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
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
let listView = null; // Will be initialized after DOM loads
let graphView = null; // Will be initialized after DOM loads
let timelineView = null; // Will be initialized after DOM loads

// ============================================
// Application Initialization
// ============================================

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log('Initializing boo-learner application...');
    
    // Load saved preferences and state
    const preferences = storageService.loadPreferences();
    const completedCourses = storageService.loadCompletedCourses();
    const graphLayout = storageService.loadGraphLayout();

    // Update state with loaded data
    stateManager.setState({
      preferences,
      completedCourses,
      graphLayout,
      viewMode: preferences.viewMode || 'graph',
      filters: preferences.filters || { status: 'all' },
      searchQuery: preferences.searchQuery || ''
    });

    // Load courses from API
    await loadCourses();

    // Initialize UI components
    initializeUI();

    // Set up event listeners
    setupEventListeners();

    // Restore view mode
    switchView(stateManager.state.viewMode);

    // Restore search query and filters in UI
    restoreUIState();

    console.log('✓ Application initialized successfully');
    console.log(`✓ Loaded ${stateManager.state.courses.length} courses`);
    console.log(`✓ ${stateManager.state.completedCourses.size} courses completed`);
    console.log(`✓ Active view: ${stateManager.state.viewMode}`);
  } catch (error) {
    console.error('✗ Error initializing application:', error);
    toast.error('Failed to initialize application. Please refresh the page.', 0);
    
    // Try to show a helpful error message
    if (!navigator.onLine) {
      toast.error('You appear to be offline. Please check your internet connection.', 0);
    }
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
  try {
    // Initialize course modal
    courseModal = new CourseModalManager();
    console.log('✓ Course modal initialized');
  } catch (error) {
    console.error('✗ Failed to initialize course modal:', error);
  }
  
  try {
    // Initialize confirm dialog
    confirmDialog = new ConfirmDialog();
    console.log('✓ Confirm dialog initialized');
  } catch (error) {
    console.error('✗ Failed to initialize confirm dialog:', error);
  }
  
  try {
    // Initialize list view
    const listContainer = document.getElementById('list-view');
    if (listContainer) {
      listView = new ListView(listContainer, stateManager);
      console.log('✓ List view initialized');
    } else {
      console.warn('⚠ List view container not found');
    }
  } catch (error) {
    console.error('✗ Failed to initialize list view:', error);
  }
  
  try {
    // Initialize graph view
    const graphContainer = document.getElementById('graph-view');
    if (graphContainer) {
      graphView = new GraphView(graphContainer, stateManager);
      console.log('✓ Graph view initialized');
    } else {
      console.warn('⚠ Graph view container not found');
    }
  } catch (error) {
    console.error('✗ Failed to initialize graph view:', error);
    // Show error in graph container if it exists
    const graphContainer = document.getElementById('graph-view');
    if (graphContainer) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'graph-error';
      errorDiv.innerHTML = `
        <div class="error-icon">⚠️</div>
        <h3>Graph View Unavailable</h3>
        <p>Failed to initialize graph visualization. Please try refreshing the page.</p>
      `;
      graphContainer.appendChild(errorDiv);
    }
  }
  
  try {
    // Initialize timeline view
    const timelineContainer = document.getElementById('timeline-view');
    if (timelineContainer) {
      timelineView = new TimelineView(timelineContainer, stateManager);
      console.log('✓ Timeline view initialized');
    } else {
      console.warn('⚠ Timeline view container not found');
    }
  } catch (error) {
    console.error('✗ Failed to initialize timeline view:', error);
  }
  
  console.log('✓ UI components initialization complete');
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

  // Set up search functionality
  setupSearch();

  // Set up filter functionality
  setupFilters();

  // Set up detail panel
  setupDetailPanel();

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // Subscribe to state changes
  stateManager.subscribe(handleStateChange);
}

/**
 * Handle state changes
 * @param {Object} state - New state
 */
function handleStateChange(state) {
  try {
    // Save preferences when they change (including filters and searchQuery)
    const preferencesToSave = {
      ...state.preferences,
      filters: state.filters,
      searchQuery: state.searchQuery
    };
    storageService.savePreferences(preferencesToSave);
    
    // Save completed courses when they change
    storageService.saveCompletedCourses(state.completedCourses);
  } catch (error) {
    console.error('Error saving state to storage:', error);
    // Continue execution even if storage fails
  }
  
  try {
    // Update progress indicator
    updateProgressIndicator(state);
  } catch (error) {
    console.error('Error updating progress indicator:', error);
  }
  
  // Update ALL views to ensure synchronization
  // This ensures that when data changes (courses added/deleted/updated,
  // completion status changed, filters applied, search performed),
  // all views reflect the same state even if they're not currently visible
  
  // Update list view
  if (listView) {
    try {
      listView.update(state.courses);
    } catch (error) {
      console.error('Error updating list view:', error);
    }
  }
  
  // Update graph view
  if (graphView) {
    try {
      graphView.update(state.courses);
    } catch (error) {
      console.error('Error updating graph view:', error);
    }
  }
  
  // Update timeline view
  if (timelineView) {
    try {
      timelineView.update(state.courses);
    } catch (error) {
      console.error('Error updating timeline view:', error);
    }
  }
}

/**
 * Restore UI state from loaded preferences
 */
function restoreUIState() {
  const state = stateManager.state;
  
  // Restore search query
  const searchInput = document.getElementById('search-input');
  if (searchInput && state.searchQuery) {
    searchInput.value = state.searchQuery;
  }
  
  // Restore filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    const isActive = btn.dataset.filter === state.filters.status;
    btn.classList.toggle('active', isActive);
  });
}

/**
 * Switch between views
 * @param {string} viewMode - View mode: 'graph', 'timeline', 'list'
 */
function switchView(viewMode) {
  // Validate view mode
  if (!['graph', 'timeline', 'list'].includes(viewMode)) {
    console.error(`Invalid view mode: ${viewMode}`);
    return;
  }

  // Update state with new view mode
  stateManager.setState({ viewMode });

  // Update view buttons active state
  document.querySelectorAll('.view-btn').forEach(btn => {
    const isActive = btn.dataset.view === viewMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  // Update view containers visibility
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  const activeView = document.getElementById(`${viewMode}-view`);
  if (activeView) {
    activeView.classList.add('active');
  }

  // Render the active view with current courses
  if (viewMode === 'list' && listView) {
    listView.update(stateManager.state.courses);
  } else if (viewMode === 'graph' && graphView) {
    graphView.update(stateManager.state.courses);
  } else if (viewMode === 'timeline' && timelineView) {
    timelineView.update(stateManager.state.courses);
  }

  // Save view mode preference to local storage
  const preferences = { ...stateManager.state.preferences, viewMode };
  stateManager.setState({ preferences });
  storageService.savePreferences(preferences);
  
  console.log(`Switched to ${viewMode} view`);
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

/**
 * Set up search functionality with debouncing
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let searchTimeout = null;

  // Debounced search handler
  const handleSearch = (query) => {
    // Update state - this will trigger handleStateChange which updates all views
    stateManager.setState({ searchQuery: query });
  };

  // Input event with debouncing (300ms delay)
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    searchTimeout = setTimeout(() => {
      handleSearch(query);
    }, 300);
  });

  // Immediate search on Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Clear timeout and search immediately
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      handleSearch(e.target.value);
    }
  });
}

/**
 * Set up filter functionality
 */
function setupFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filterValue = e.currentTarget.dataset.filter;
      
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // Update state - this will trigger handleStateChange which updates all views
      stateManager.setState({ 
        filters: { status: filterValue } 
      });
    });
  });
}

/**
 * Set up keyboard shortcuts for view switching and other actions
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if user is typing in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Exception: Allow '/' to focus search even from inputs
      if (e.key === '/' && e.target.id !== 'search-input') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
      return;
    }
    
    // View switching shortcuts: 1, 2, 3
    if (e.key === '1') {
      e.preventDefault();
      switchView('graph');
    } else if (e.key === '2') {
      e.preventDefault();
      switchView('timeline');
    } else if (e.key === '3') {
      e.preventDefault();
      switchView('list');
    }
    
    // Focus search with '/'
    else if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }
    
    // New course with 'n'
    else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openCourseModal();
    }
    
    // Show keyboard shortcuts help with '?'
    else if (e.key === '?') {
      e.preventDefault();
      showKeyboardShortcuts();
    }
  });
}

/**
 * Show keyboard shortcuts modal
 */
function showKeyboardShortcuts() {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  
  // Show modal
  modal.classList.add('open');
  
  // Set up close handlers
  const closeButtons = modal.querySelectorAll('.shortcuts-close');
  const overlay = modal.querySelector('.modal-overlay');
  
  const closeModal = () => {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.classList.remove('open', 'closing');
    }, 300);
  };
  
  closeButtons.forEach(btn => {
    btn.onclick = closeModal;
  });
  
  if (overlay) {
    overlay.onclick = closeModal;
  }
  
  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
}

// ============================================
// Global Error Handlers
// ============================================

/**
 * Global error handler for unhandled errors
 */
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  
  // Don't show toast for every error, only critical ones
  if (event.error && event.error.message) {
    const message = event.error.message.toLowerCase();
    
    // Show toast for critical errors
    if (message.includes('network') || message.includes('fetch') || message.includes('api')) {
      if (toast) {
        toast.error('A network error occurred. Please check your connection.', 5000);
      }
    }
  }
  
  // Don't prevent default error handling
  return false;
});

/**
 * Global handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Show toast for API errors
  if (event.reason instanceof APIError) {
    if (toast) {
      toast.error(`Error: ${event.reason.message}`, 5000);
    }
  }
  
  // Prevent default error handling
  event.preventDefault();
});

// ============================================
// Start Application
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
