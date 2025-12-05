// ============================================
// Main Application Entry Point
// ============================================

import { APIError } from './errors.js';
import StateManager from './state-manager.js';
import APIClient from './api-client.js';
import StorageService from './storage-service.js';
import ToastNotification from './toast-notification.js';
import { ConfirmDialog } from './modal-manager.js';
import CourseModalManager from './course-modal.js';
import ListView from './list-view.js';
import TimelineView from './timeline-view.js';

// Global instances
let stateManager;
let apiClient;
let storageService;
let toast;
let courseModal;
let confirmDialog;
let listView;
let graphView;
let timelineView;

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Initialize core services
    stateManager = new StateManager();
    apiClient = new APIClient();
    storageService = new StorageService();
    toast = new ToastNotification();

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
  courseModal = new CourseModalManager(stateManager, apiClient, toast, loadCourses);
  
  // Initialize confirm dialog
  confirmDialog = new ConfirmDialog();
  
  // Initialize list view
  const listContainer = document.getElementById('list-view');
  if (listContainer) {
    listView = new ListView(listContainer, stateManager);
  }
  
  // Initialize graph view (if available - requires D3.js)
  const graphContainer = document.getElementById('graph-view');
  if (graphContainer && typeof d3 !== 'undefined') {
    // Graph view will be loaded separately due to its size
    console.log('Graph view container found, but GraphView class needs to be loaded');
  }
  
  // Initialize timeline view
  const timelineContainer = document.getElementById('timeline-view');
  if (timelineContainer) {
    timelineView = new TimelineView(timelineContainer, stateManager, apiClient, toast);
  }
  
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

  // Set up search functionality
  setupSearch();

  // Set up filter functionality
  setupFilters();

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
  const preferencesToSave = {
    ...state.preferences,
    filters: state.filters,
    searchQuery: state.searchQuery
  };
  storageService.savePreferences(preferencesToSave);
  
  // Save completed courses when they change
  storageService.saveCompletedCourses(state.completedCourses);
  
  // Update progress indicator
  updateProgressIndicator(state);
  
  // Update active view
  if (listView && state.viewMode === 'list') {
    listView.update(state.courses);
  }
  
  if (graphView && state.viewMode === 'graph') {
    graphView.update(state.courses);
  }
  
  if (timelineView && state.viewMode === 'timeline') {
    timelineView.update(state.courses);
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

  // Render the active view
  if (viewMode === 'list' && listView) {
    listView.update(stateManager.state.courses);
  } else if (viewMode === 'graph' && graphView) {
    graphView.update(stateManager.state.courses);
  } else if (viewMode === 'timeline' && timelineView) {
    timelineView.update(stateManager.state.courses);
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
    
    await loadCourses();
    closeDetailPanel();
    
  } catch (error) {
    console.error('Error deleting course:', error);
    
    if (error instanceof APIError) {
      if (error.status === 404) {
        toast.error('Course not found. It may have already been deleted.');
        await loadCourses();
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

  detailTitle.textContent = course.name;

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

  editBtn.onclick = () => {
    closeDetailPanel();
    openCourseModal(course);
  };

  deleteBtn.onclick = () => {
    deleteCourse(course);
  };

  panel.classList.add('open');
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

  const handleSearch = (query) => {
    stateManager.setState({ searchQuery: query });
    
    if (listView && stateManager.state.viewMode === 'list') {
      listView.update(stateManager.state.courses);
    }
  };

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
      handleSearch(query);
    }, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      handleSearch(e.target.value);
    }
  });

  // Focus search with '/' keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
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
      
      filterButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      stateManager.setState({ 
        filters: { status: filterValue } 
      });
      
      if (listView && stateManager.state.viewMode === 'list') {
        listView.update(stateManager.state.courses);
      }
    });
  });
}

// Export functions for global access
window.openDetailPanel = openDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.openCourseModal = openCourseModal;
window.deleteCourse = deleteCourse;
window.showLoading = showLoading;

// Export instances for cross-module access
window.stateManager = stateManager;
window.graphView = graphView;
window.timelineView = timelineView;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
