// ============================================
// CourseModalManager - Course Creation/Editing Modal
// ============================================

import { ModalManager } from './modal-manager.js';
import ValidationUtils from './validation-utils.js';

class CourseModalManager extends ModalManager {
  constructor(stateManager, apiClient, toast, loadCourses) {
    super('course-modal');
    this.stateManager = stateManager;
    this.apiClient = apiClient;
    this.toast = toast;
    this.loadCourses = loadCourses;
    
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
    
    const courses = this.stateManager.state.courses;
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
      this.toast.error('Please fix the errors before submitting');
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
      this.toast.error('Please fix the errors before submitting');
      return;
    }
    
    // Disable submit button and show loading state
    const originalText = this.submitBtn.textContent;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Saving...';
    this.submitBtn.style.opacity = '0.6';
    this.submitBtn.style.cursor = 'not-allowed';
    
    try {
      let result;
      if (this.mode === 'create') {
        result = await this.apiClient.createCourse(courseData);
        this.toast.success('Course created successfully!');
      } else {
        result = await this.apiClient.updateCourse(this.currentCourse.id, courseData);
        this.toast.success('Course updated successfully!');
      }
      
      // Reload courses
      await this.loadCourses();
      
      // Close modal
      this.close();
      
    } catch (error) {
      console.error('Error saving course:', error);
      
      if (error.name === 'APIError') {
        if (error.status === 409) {
          this.toast.error('Circular dependency detected. Please adjust the dependencies.', 0);
        } else {
          this.toast.error(`Failed to save course: ${error.message}`, 0);
        }
      } else {
        this.toast.error('Failed to save course. Please try again.', 0);
      }
    } finally {
      // Re-enable submit button
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = originalText;
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.cursor = 'pointer';
    }
  }
}

export default CourseModalManager;
