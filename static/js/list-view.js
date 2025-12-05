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
      // Call global function
      if (typeof window.openDetailPanel === 'function') {
        window.openDetailPanel(course);
      }
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

export default ListView;
