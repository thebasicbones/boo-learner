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

export default StorageService;
