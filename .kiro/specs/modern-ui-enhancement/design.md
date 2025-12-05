# Design Document: Modern UI Enhancement

## Overview

This design transforms the boo-learner study planner from a basic CRUD interface into a visually stunning, highly interactive application. The enhanced UI leverages modern web technologies including D3.js for graph visualization, CSS Grid/Flexbox for responsive layouts, and Web Animations API for smooth transitions. The design emphasizes visual hierarchy, intuitive interactions, and accessibility while maintaining the existing FastAPI backend architecture.

The application will feature three primary views: a force-directed dependency graph, a timeline-based learning path, and a traditional list view. Users can seamlessly switch between these views while maintaining consistent state and interactions across all visualizations.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Graph View  │  │ Timeline View│  │   List View  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  State Manager  │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │   API Client    │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  FastAPI Backend│
                    │  (Existing)     │
                    └─────────────────┘
```

### Component Structure

**View Components:**
- `GraphView`: D3.js-based force-directed graph visualization
- `TimelineView`: Horizontal/vertical timeline showing course sequence
- `ListView`: Accessible table/card-based course list
- `CourseModal`: Modal dialog for creating/editing courses
- `CourseDetailPanel`: Sliding panel for course information
- `SearchBar`: Real-time search and filter interface
- `ProgressIndicator`: Visual progress tracking component

**Core Services:**
- `StateManager`: Centralized state management using reactive patterns
- `APIClient`: HTTP client for backend communication with retry logic
- `StorageService`: Local storage management for preferences and offline data
- `AnimationController`: Coordinated animations across components
- `GraphLayoutEngine`: Force simulation and layout calculations

**Utility Modules:**
- `ValidationUtils`: Client-side form validation
- `ColorScheme`: Consistent color palette management
- `AccessibilityHelper`: ARIA labels and keyboard navigation
- `ToastNotifications`: User feedback system

## Components and Interfaces

### StateManager

The StateManager uses a reactive state pattern to ensure all views stay synchronized.

```javascript
class StateManager {
  constructor() {
    this.state = {
      courses: [],
      selectedCourse: null,
      viewMode: 'graph', // 'graph' | 'timeline' | 'list'
      searchQuery: '',
      filters: { status: 'all' },
      graphLayout: {},
      completedCourses: new Set()
    };
    this.subscribers = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => this.unsubscribe(callback);
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }
}
```

### APIClient

Handles all backend communication with error handling and retry logic.

```javascript
class APIClient {
  constructor(baseURL = '/api/v1') {
    this.baseURL = baseURL;
    this.retryAttempts = 3;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);
        if (!response.ok) {
          const error = await response.json();
          throw new APIError(error.message, response.status);
        }
        return await response.json();
      } catch (error) {
        if (attempt === this.retryAttempts - 1) throw error;
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  async getCourses() {
    return this.request('/resources');
  }

  async createCourse(data) {
    return this.request('/resources', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCourse(id, data) {
    return this.request(`/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCourse(id) {
    return this.request(`/resources/${id}`, {
      method: 'DELETE'
    });
  }

  async getTopologicalSort() {
    return this.request('/resources/sorted');
  }
}
```

### GraphView Component

Uses D3.js force simulation for interactive graph visualization.

```javascript
class GraphView {
  constructor(container, stateManager) {
    this.container = container;
    this.stateManager = stateManager;
    this.svg = null;
    this.simulation = null;
    this.nodes = [];
    this.links = [];
  }

  initialize() {
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter())
      .force('collision', d3.forceCollide().radius(60));

    this.setupZoom();
    this.setupDrag();
  }

  update(courses) {
    this.nodes = courses.map(c => ({
      id: c.id,
      name: c.name,
      completed: this.stateManager.state.completedCourses.has(c.id)
    }));

    this.links = [];
    courses.forEach(course => {
      course.dependencies.forEach(depId => {
        this.links.push({ source: depId, target: course.id });
      });
    });

    this.render();
  }

  render() {
    // D3.js rendering logic with enter/update/exit pattern
    // Includes hover effects, click handlers, and animations
  }

  highlightNode(nodeId) {
    // Highlight node and connected edges
  }

  centerOnNode(nodeId) {
    // Smooth zoom and pan to center on specific node
  }
}
```

### TimelineView Component

Displays courses in topologically sorted levels.

```javascript
class TimelineView {
  constructor(container, stateManager) {
    this.container = container;
    this.stateManager = stateManager;
  }

  async update(courses) {
    const sorted = await this.apiClient.getTopologicalSort();
    const levels = this.groupIntoLevels(sorted);
    this.render(levels);
  }

  groupIntoLevels(sortedCourses) {
    const levels = [];
    const processed = new Set();
    
    sortedCourses.forEach(course => {
      const level = this.calculateLevel(course, processed);
      if (!levels[level]) levels[level] = [];
      levels[level].push(course);
      processed.add(course.id);
    });

    return levels;
  }

  calculateLevel(course, processed) {
    if (course.dependencies.length === 0) return 0;
    
    const depLevels = course.dependencies
      .filter(depId => processed.has(depId))
      .map(depId => this.getLevelOfCourse(depId));
    
    return Math.max(...depLevels, 0) + 1;
  }

  render(levels) {
    // Render timeline with CSS Grid
    // Each level is a column, courses within level are rows
  }
}
```

## Data Models

### Frontend Course Model

```typescript
interface Course {
  id: string;
  name: string;
  description: string | null;
  dependencies: string[];
  created_at: string;
  updated_at: string;
  // Frontend-only fields
  completed?: boolean;
  position?: { x: number; y: number };
  level?: number;
}

interface AppState {
  courses: Course[];
  selectedCourse: Course | null;
  viewMode: 'graph' | 'timeline' | 'list';
  searchQuery: string;
  filters: {
    status: 'all' | 'completed' | 'available' | 'locked';
  };
  graphLayout: Record<string, { x: number; y: number }>;
  completedCourses: Set<string>;
  preferences: UserPreferences;
}

interface UserPreferences {
  viewMode: string;
  theme: 'light' | 'dark';
  animationsEnabled: boolean;
  graphPhysics: {
    linkDistance: number;
    chargeStrength: number;
  };
}
```

### Storage Schema

```typescript
// LocalStorage keys
const STORAGE_KEYS = {
  PREFERENCES: 'boo-learner:preferences',
  COMPLETED_COURSES: 'boo-learner:completed',
  GRAPH_LAYOUT: 'boo-learner:graph-layout',
  PENDING_CHANGES: 'boo-learner:pending-changes'
};

interface StoredData {
  preferences: UserPreferences;
  completedCourses: string[];
  graphLayout: Record<string, { x: number; y: number }>;
  pendingChanges: PendingChange[];
}

interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Input validation consistency
*For any* course creation or update with invalid data (empty name, whitespace-only fields), the validation should reject the input and display appropriate error messages before submission.
**Validates: Requirements 1.2**

### Property 2: View synchronization on updates
*For any* course update (name, description, or dependencies), all active views (graph, timeline, list) should reflect the updated data immediately without requiring manual refresh.
**Validates: Requirements 1.4**

### Property 3: Graph structure correctness
*For any* set of courses with dependencies, the rendered graph should have exactly one node per course and one directed edge for each dependency relationship.
**Validates: Requirements 2.1**

### Property 4: Hover highlight correctness
*For any* course node in the graph, hovering should highlight that node plus all nodes that are direct dependencies (incoming edges) and all nodes that depend on it (outgoing edges).
**Validates: Requirements 2.2**

### Property 5: Drag maintains connectivity
*For any* course node that is dragged to a new position, all edges connected to that node should remain attached and update their positions accordingly.
**Validates: Requirements 2.4**

### Property 6: Topological sort validity
*For any* set of courses with dependencies (without cycles), the timeline view should display courses in an order where every course appears after all its dependencies.
**Validates: Requirements 3.1**

### Property 7: Level grouping independence
*For any* two courses in the same timeline level, neither course should have a dependency on the other (directly or transitively).
**Validates: Requirements 3.2**

### Property 8: Cross-view highlight synchronization
*For any* course, when hovered in either the timeline or graph view, both views should highlight the same course simultaneously.
**Validates: Requirements 3.3**

### Property 9: Mobile tap target sizing
*For any* interactive element in mobile view (viewport < 768px), the tap target should be at least 44x44 pixels to meet accessibility standards.
**Validates: Requirements 5.2**

### Property 10: State preservation across layouts
*For any* application state (selected course, search query, filters), switching between desktop and mobile layouts should preserve all state values.
**Validates: Requirements 5.4**

### Property 11: Loading indicators for async operations
*For any* API request (create, update, delete, fetch), a loading indicator should be displayed from request start until response or error.
**Validates: Requirements 6.1**

### Property 12: Error notification display
*For any* error that occurs (API failure, validation error, network error), a toast notification should be displayed with an error message.
**Validates: Requirements 6.2**

### Property 13: Inline validation feedback
*For any* form input that fails validation rules, an inline error message should appear near the input field before form submission is attempted.
**Validates: Requirements 6.3**

### Property 14: Success notification display
*For any* successful action (course created, updated, deleted), a success toast notification should be displayed.
**Validates: Requirements 6.4**

### Property 15: Completion state updates
*For any* course, toggling its completion checkbox should update the course's completed state in the state manager and trigger visual updates in all views.
**Validates: Requirements 7.1**

### Property 16: Completed styling consistency
*For any* course marked as completed, both the graph node and timeline card should display the completed visual style.
**Validates: Requirements 7.2**

### Property 17: Progress calculation accuracy
*For any* set of courses with completion states, the displayed progress percentage should equal (completed courses / total courses) × 100.
**Validates: Requirements 7.3**

### Property 18: Course availability logic
*For any* course, if all of its dependencies are marked as completed, the course should be highlighted as available to start.
**Validates: Requirements 7.4**

### Property 19: Filter application consistency
*For any* filter selection (all, completed, available, locked), only courses matching that filter should be visible in all views.
**Validates: Requirements 7.5**

### Property 20: Search matching accuracy
*For any* search query, the displayed courses should be exactly those whose name or description contains the query string (case-insensitive).
**Validates: Requirements 8.1**

### Property 21: Search highlight presence
*For any* search query that returns results, the matching text within course names and descriptions should be visually highlighted.
**Validates: Requirements 8.2**

### Property 22: Filter synchronization across views
*For any* applied filter, both the graph and timeline views should display the exact same set of filtered courses.
**Validates: Requirements 8.3**

### Property 23: Search restoration completeness
*For any* active search query, clearing the search should restore all courses that were previously hidden by the search filter.
**Validates: Requirements 8.5**

### Property 24: Tab navigation order
*For any* sequence of Tab key presses, focus should move through interactive elements in a logical order (top to bottom, left to right).
**Validates: Requirements 9.1**

### Property 25: ARIA label completeness
*For any* interactive element (buttons, inputs, links, graph nodes), an appropriate ARIA label or aria-labelledby attribute should be present.
**Validates: Requirements 9.3**

### Property 26: Preference persistence
*For any* user preference change (view mode, theme, animation settings), the new value should be saved to local storage and retrievable on next load.
**Validates: Requirements 10.1**

### Property 27: Completion persistence
*For any* course completion toggle, the new completion state should be persisted to the backend database via API call.
**Validates: Requirements 10.2**

### Property 28: Layout position persistence
*For any* manually adjusted node position in the graph, the new position should be saved to local storage with the course ID as key.
**Validates: Requirements 10.4**

### Property 29: Offline change queuing
*For any* data modification that fails due to network error, the change should be added to a pending changes queue in local storage for later retry.
**Validates: Requirements 10.5**

## Error Handling

### Client-Side Errors

**Validation Errors:**
- Display inline error messages near the invalid input
- Prevent form submission until all validation passes
- Use red color scheme and error icons for visibility

**Network Errors:**
- Show toast notification with retry option
- Queue failed changes in local storage
- Implement exponential backoff for retries
- Display offline indicator in UI header

**Circular Dependency Errors:**
- Highlight the cycle in the graph with pulsing red animation
- Display error modal with explanation and affected courses
- Prevent saving until cycle is resolved
- Suggest removing specific dependencies to break the cycle

### Error Recovery

```javascript
class ErrorHandler {
  handleAPIError(error, context) {
    if (error.status === 404) {
      this.showToast('Course not found. It may have been deleted.', 'error');
      this.stateManager.refreshCourses();
    } else if (error.status === 409) {
      // Circular dependency
      this.highlightCycle(error.details.cycle);
      this.showModal('Circular Dependency Detected', error.message);
    } else if (error.status >= 500) {
      this.showToast('Server error. Your changes have been saved locally.', 'error');
      this.queuePendingChange(context);
    } else if (!navigator.onLine) {
      this.showToast('You are offline. Changes will sync when connection is restored.', 'warning');
      this.queuePendingChange(context);
    } else {
      this.showToast(error.message || 'An unexpected error occurred.', 'error');
    }
  }

  queuePendingChange(change) {
    const pending = this.storageService.getPendingChanges();
    pending.push({
      id: generateId(),
      ...change,
      timestamp: Date.now()
    });
    this.storageService.savePendingChanges(pending);
  }

  async retryPendingChanges() {
    const pending = this.storageService.getPendingChanges();
    const failed = [];

    for (const change of pending) {
      try {
        await this.executeChange(change);
      } catch (error) {
        failed.push(change);
      }
    }

    this.storageService.savePendingChanges(failed);
    if (failed.length === 0) {
      this.showToast('All pending changes synced successfully!', 'success');
    }
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific component behaviors and edge cases:

**Component Tests:**
- Modal dialog opens and closes correctly
- Course detail panel displays correct information
- Empty state renders when no courses exist
- Mobile layout switches at 768px breakpoint
- Keyboard shortcuts trigger correct actions
- Toast notifications appear and auto-dismiss

**Utility Function Tests:**
- Search query matching (case-insensitive, partial matches)
- Progress percentage calculation
- Level grouping algorithm for timeline
- Local storage save/load operations
- ARIA label generation

**Integration Tests:**
- API client retry logic with mock failures
- State manager notification to subscribers
- Cross-view synchronization on state changes

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs using a JavaScript PBT library (fast-check):

**Graph Visualization Properties:**
- Graph structure correctness (nodes and edges match data)
- Drag maintains connectivity (edges stay attached)
- Hover highlights correct related nodes

**Timeline Properties:**
- Topological sort validity (dependencies before dependents)
- Level grouping independence (no dependencies within level)

**State Management Properties:**
- View synchronization (all views reflect same data)
- State preservation (layout switches maintain state)
- Filter consistency (same courses in all views)

**Validation Properties:**
- Input validation consistency (invalid data rejected)
- Search matching accuracy (correct courses returned)
- Progress calculation accuracy (percentage correct)

**Persistence Properties:**
- Preference persistence (saved and restored correctly)
- Layout position persistence (node positions saved)
- Offline change queuing (failed changes queued)

Each property test will run a minimum of 100 iterations with randomly generated test data to ensure robustness across a wide range of inputs.

## Visual Design System

### Color Palette

```css
:root {
  /* Primary Colors */
  --primary-500: #6366f1; /* Indigo */
  --primary-600: #4f46e5;
  --primary-700: #4338ca;
  
  /* Accent Colors */
  --accent-500: #ec4899; /* Pink */
  --accent-600: #db2777;
  
  /* Status Colors */
  --success-500: #10b981; /* Green */
  --warning-500: #f59e0b; /* Amber */
  --error-500: #ef4444; /* Red */
  
  /* Neutral Colors */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-700: #374151;
  --gray-900: #111827;
  
  /* Course State Colors */
  --course-available: #10b981;
  --course-locked: #9ca3af;
  --course-completed: #6366f1;
  --course-in-progress: #f59e0b;
  
  /* Graph Colors */
  --node-default: #6366f1;
  --node-hover: #ec4899;
  --node-selected: #8b5cf6;
  --edge-default: #cbd5e1;
  --edge-highlight: #ec4899;
}
```

### Typography

```css
:root {
  /* Font Families */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Font Sizes */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Spacing System

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
}
```

### Glassmorphism Effects

```css
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.glass-card-dark {
  background: rgba(17, 24, 39, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Animation Principles

**Timing Functions:**
- `ease-out`: For elements entering the screen
- `ease-in`: For elements leaving the screen
- `ease-in-out`: For elements moving within the screen
- Custom cubic-bezier for spring-like effects: `cubic-bezier(0.34, 1.56, 0.64, 1)`

**Duration Guidelines:**
- Micro-interactions: 150-200ms
- Component transitions: 250-350ms
- Page transitions: 400-500ms
- Complex animations: 600-800ms

**Animation Examples:**

```css
/* Fade in */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Pulse (for errors/highlights) */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

/* Slide in from right */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

## Responsive Breakpoints

```css
/* Mobile: < 768px */
@media (max-width: 767px) {
  .graph-container {
    height: 400px;
  }
  
  .timeline {
    flex-direction: column;
  }
  
  .course-modal {
    width: 95vw;
    margin: var(--space-2);
  }
}

/* Tablet: 768px - 1023px */
@media (min-width: 768px) and (max-width: 1023px) {
  .graph-container {
    height: 500px;
  }
  
  .sidebar {
    width: 300px;
  }
}

/* Desktop: >= 1024px */
@media (min-width: 1024px) {
  .graph-container {
    height: calc(100vh - 200px);
  }
  
  .sidebar {
    width: 400px;
  }
  
  .timeline {
    padding: var(--space-8);
  }
}
```

## Performance Considerations

### Optimization Strategies

**Virtual Scrolling:**
- Implement virtual scrolling for course lists with > 100 items
- Only render visible items plus small buffer
- Use Intersection Observer API for lazy loading

**Graph Rendering:**
- Limit force simulation iterations for large graphs (> 50 nodes)
- Use canvas rendering instead of SVG for graphs with > 100 nodes
- Implement level-of-detail: simplify distant nodes

**Debouncing and Throttling:**
- Debounce search input: 300ms delay
- Throttle graph drag events: 16ms (60fps)
- Throttle window resize: 150ms

**Code Splitting:**
- Lazy load D3.js only when graph view is activated
- Split timeline and list views into separate chunks
- Load animation library on-demand

**Caching:**
- Cache topological sort results until dependencies change
- Memoize level calculations for timeline
- Cache rendered graph layouts in memory

### Performance Budgets

- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Graph render time: < 500ms for 50 nodes
- View switch time: < 200ms
- Search response time: < 100ms

## Accessibility Features

### Keyboard Navigation

**Global Shortcuts:**
- `?`: Show keyboard shortcuts help
- `/`: Focus search input
- `Esc`: Close modals/panels
- `Tab`: Navigate forward
- `Shift+Tab`: Navigate backward

**View Navigation:**
- `1`: Switch to graph view
- `2`: Switch to timeline view
- `3`: Switch to list view
- `n`: Create new course
- `f`: Toggle filters

**Course Actions:**
- `Enter`: Open selected course details
- `e`: Edit selected course
- `Delete`: Delete selected course (with confirmation)
- `Space`: Toggle completion status

### Screen Reader Support

**ARIA Labels:**
```html
<button aria-label="Add new course" aria-describedby="add-course-help">
  <svg aria-hidden="true">...</svg>
</button>

<div role="region" aria-label="Course dependency graph">
  <svg role="img" aria-label="Interactive graph showing 12 courses and their dependencies">
    <!-- Graph content -->
  </svg>
</div>

<div role="status" aria-live="polite" aria-atomic="true">
  Course "Introduction to Python" created successfully
</div>
```

**Focus Management:**
- Trap focus within modals
- Return focus to trigger element when modal closes
- Provide skip links for main content areas
- Ensure focus is visible with custom focus styles

### Alternative Views

**List View for Graph:**
- Provide table view showing all courses with dependencies
- Include sortable columns
- Support keyboard navigation through rows
- Announce sort changes to screen readers

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Set up new HTML structure with semantic markup
- Implement StateManager and APIClient
- Create base CSS with design system variables
- Build responsive layout grid

### Phase 2: Core Views (Week 2)
- Implement ListView with search and filters
- Build CourseModal for create/edit
- Add toast notification system
- Implement local storage service

### Phase 3: Graph Visualization (Week 3)
- Integrate D3.js force-directed graph
- Implement node interactions (hover, click, drag)
- Add graph controls (zoom, pan, reset)
- Implement cross-view synchronization

### Phase 4: Timeline View (Week 4)
- Build timeline layout with level grouping
- Implement topological sort visualization
- Add timeline interactions
- Sync timeline with graph view

### Phase 5: Progress Tracking (Week 5)
- Add completion status to data model
- Implement completion UI in all views
- Build progress indicators
- Add course availability logic

### Phase 6: Polish & Accessibility (Week 6)
- Implement all animations and transitions
- Add keyboard navigation
- Complete ARIA labels and screen reader support
- Optimize performance
- Cross-browser testing

### Phase 7: Testing & Refinement (Week 7)
- Write unit tests for all components
- Implement property-based tests
- Fix bugs and edge cases
- User testing and feedback incorporation
