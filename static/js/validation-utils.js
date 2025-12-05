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

export default ValidationUtils;
