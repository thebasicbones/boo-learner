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

export default StateManager;
