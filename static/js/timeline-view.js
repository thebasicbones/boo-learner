// ============================================
// TimelineView - Timeline View Component
// ============================================

class TimelineView {
  constructor(container, stateManager, apiClient, toast) {
    this.container = container;
    this.stateManager = stateManager;
    this.apiClient = apiClient;
    this.toast = toast;
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
      this.sortedCourses = await this.apiClient.getTopologicalSort();
    } catch (error) {
      console.error('Error fetching sorted courses:', error);
      
      if (error.name === 'APIError' && error.status === 409) {
        // Circular dependency detected
        const cycleInfo = error.details?.cycle || [];
        this.displayCircularDependencyError(cycleInfo);
        throw error;
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

    // Show error toast
    this.toast.error('Circular dependency detected. Please fix the course dependencies to view the timeline.', 0);
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
      if (e.target.classList.contains('timeline-card-checkbox')) {
        return;
      }
      if (typeof window.openDetailPanel === 'function') {
        window.openDetailPanel(course);
      }
    });

    // Add checkbox handler
    const checkbox = card.querySelector('.timeline-card-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
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
        if (typeof window.openDetailPanel === 'function') {
          window.openDetailPanel(course);
        }
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
      await this.update(this.stateManager.state.courses);
    } catch (error) {
      console.error('Error toggling completion:', error);
      await this.update(this.stateManager.state.courses);
    }
  }

  /**
   * Highlight a course (for cross-view synchronization)
   * @param {string} courseId - Course ID to highlight
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightCourse(courseId, highlight) {
    const card = this.timelineContainer.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
      card.classList.toggle('highlighted', highlight);
    }
    
    // Trigger highlight in graph view if available
    if (window.graphView && typeof window.graphView.highlightNodeExternal === 'function') {
      window.graphView.highlightNodeExternal(courseId, highlight);
    }
  }

  /**
   * Highlight a course externally (for cross-view synchronization from graph)
   * @param {string} courseId - Course ID to highlight
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightCourseExternal(courseId, highlight) {
    const card = this.timelineContainer.querySelector(`[data-course-id="${courseId}"]`);
    if (card) {
      card.classList.toggle('highlighted', highlight);
      
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

export default TimelineView;
