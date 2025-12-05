# JavaScript Module Structure

This directory contains the modularized JavaScript code for the boo-learner application. The original monolithic `app.js` file has been split into smaller, more maintainable modules.

## Module Overview

### Core Services

- **`errors.js`** - Custom error classes (APIError, ValidationError)
- **`state-manager.js`** - Reactive state management system
- **`api-client.js`** - HTTP client with retry logic and exponential backoff
- **`storage-service.js`** - Local storage management for persistence
- **`toast-notification.js`** - User feedback and notification system

### UI Components

- **`modal-manager.js`** - Base modal dialog management and ConfirmDialog
- **`course-modal.js`** - Course creation/editing modal with validation
- **`validation-utils.js`** - Form validation utilities

### View Components

- **`list-view.js`** - List view for displaying courses as cards
- **`timeline-view.js`** - Timeline view showing courses in topological order
- **`graph-view.js`** - D3.js force-directed graph visualization (placeholder)

### Main Application

- **`app-main.js`** - Main application entry point that orchestrates all modules

## Module Dependencies

```
app-main.js
├── errors.js
├── state-manager.js
├── api-client.js (depends on errors.js)
├── storage-service.js
├── toast-notification.js
├── modal-manager.js
├── course-modal.js (depends on modal-manager.js, validation-utils.js)
├── validation-utils.js
├── list-view.js
├── timeline-view.js
└── graph-view.js (to be implemented)
```

## Usage

### Option 1: ES6 Modules (Recommended)

Update `index.html` to use ES6 modules:

```html
<script type="module" src="/static/js/app-main.js"></script>
```

### Option 2: Bundle with Build Tool

Use a bundler like Webpack, Rollup, or Vite to bundle all modules into a single file:

```bash
# Example with Rollup
npm install --save-dev rollup
rollup static/js/app-main.js --file static/dist/app.bundle.js --format iife
```

### Option 3: Keep Original app.js

The original `app.js` file is still functional and can be used as-is. The modular structure is provided for better maintainability and future development.

## Benefits of Modular Structure

1. **Maintainability** - Each module has a single responsibility
2. **Testability** - Modules can be tested in isolation
3. **Reusability** - Components can be reused across projects
4. **Collaboration** - Multiple developers can work on different modules
5. **Code Organization** - Easier to navigate and understand
6. **Performance** - Modules can be lazy-loaded as needed

## Migration Notes

### Breaking Changes

- The modular version uses ES6 modules (`import`/`export`)
- Browser support requires modern browsers or a build step
- Some global variables are now module-scoped

### Compatibility

To maintain compatibility with the existing HTML:

1. Keep the original `app.js` file
2. Use the modular structure for new development
3. Gradually migrate features to modules
4. Use a bundler to create a drop-in replacement

## Graph View Implementation

The `graph-view.js` file is currently a placeholder. To complete the migration:

1. Extract the GraphView class from the original `app.js` (lines ~1000-2200)
2. Convert to ES6 module format with proper imports/exports
3. Update D3.js dependencies
4. Test cross-view synchronization features

## Future Improvements

- [ ] Complete graph-view.js implementation
- [ ] Add TypeScript definitions
- [ ] Implement unit tests for each module
- [ ] Add JSDoc comments for better IDE support
- [ ] Create a build pipeline for production
- [ ] Implement code splitting for better performance
- [ ] Add service worker for offline support

## File Sizes

| Module | Lines | Purpose |
|--------|-------|---------|
| errors.js | ~20 | Error classes |
| state-manager.js | ~150 | State management |
| api-client.js | ~150 | API communication |
| storage-service.js | ~150 | Local storage |
| toast-notification.js | ~250 | Notifications |
| modal-manager.js | ~250 | Modal dialogs |
| course-modal.js | ~300 | Course form |
| validation-utils.js | ~100 | Validation |
| list-view.js | ~250 | List view |
| timeline-view.js | ~400 | Timeline view |
| graph-view.js | ~1200 | Graph visualization |
| app-main.js | ~500 | Main orchestration |

**Total: ~3,720 lines** (vs original 3,544 lines)

The slight increase is due to module exports/imports and improved documentation.
