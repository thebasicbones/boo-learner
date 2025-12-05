// FastAPI CRUD - Frontend JavaScript

const API_BASE_URL = '/api/v1';

// State management
let resources = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadResources();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('resource-form');
    if (form) {
        form.addEventListener('submit', handleCreateResource);
    }
}

// Load all resources
async function loadResources() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/resources`);
        
        if (!response.ok) {
            throw new Error('Failed to load resources');
        }
        
        resources = await response.json();
        renderResources();
    } catch (error) {
        showError('Failed to load resources: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Render resources list
function renderResources() {
    const container = document.getElementById('resources-list');
    if (!container) return;
    
    if (resources.length === 0) {
        container.innerHTML = '<p class="loading">No resources found. Create one to get started!</p>';
        return;
    }
    
    const html = resources.map(resource => `
        <div class="resource-item" data-id="${resource.id}">
            <div class="resource-info">
                <h3>${escapeHtml(resource.name)}</h3>
                <p>${escapeHtml(resource.description || 'No description')}</p>
                ${resource.dependencies && resource.dependencies.length > 0 ? `
                    <div class="dependencies">
                        <strong>Dependencies:</strong>
                        ${resource.dependencies.map(dep => `<span>${escapeHtml(dep)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="resource-actions">
                <button onclick="editResource('${resource.id}')">Edit</button>
                <button class="btn-danger" onclick="deleteResource('${resource.id}')">Delete</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Handle create resource form submission
async function handleCreateResource(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description') || null,
        dependencies: formData.get('dependencies') 
            ? formData.get('dependencies').split(',').map(d => d.trim()).filter(d => d)
            : []
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create resource');
        }
        
        showSuccess('Resource created successfully!');
        form.reset();
        await loadResources();
    } catch (error) {
        showError('Failed to create resource: ' + error.message);
    }
}

// Edit resource
async function editResource(id) {
    const resource = resources.find(r => r.id === id);
    if (!resource) return;
    
    const name = prompt('Enter new name:', resource.name);
    if (!name) return;
    
    const description = prompt('Enter new description:', resource.description || '');
    
    try {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                description: description || null,
                dependencies: resource.dependencies || []
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update resource');
        }
        
        showSuccess('Resource updated successfully!');
        await loadResources();
    } catch (error) {
        showError('Failed to update resource: ' + error.message);
    }
}

// Delete resource
async function deleteResource(id) {
    if (!confirm('Are you sure you want to delete this resource?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete resource');
        }
        
        showSuccess('Resource deleted successfully!');
        await loadResources();
    } catch (error) {
        showError('Failed to delete resource: ' + error.message);
    }
}

// Utility functions
function showLoading() {
    const container = document.getElementById('resources-list');
    if (container) {
        container.innerHTML = '<p class="loading">Loading resources...</p>';
    }
}

function hideLoading() {
    // Loading is hidden when content is rendered
}

function showError(message) {
    showAlert(message, 'error');
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
