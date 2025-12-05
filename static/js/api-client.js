// ============================================
// APIClient - HTTP Client with Retry Logic
// ============================================

import { APIError } from './errors.js';

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

export default APIClient;
