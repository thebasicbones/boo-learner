# Implementation Plan

- [x] 1. Set up foundation and design system
- [x] 1.1 Create new HTML structure with semantic markup and modern layout
  - Replace existing static/index.html with new structure including header, main content area, and view containers
  - Add meta tags for responsive design and accessibility
  - Include CDN links for D3.js library
  - _Requirements: 4.1, 5.1_

- [x] 1.2 Implement CSS design system with variables and base styles
  - Create comprehensive CSS custom properties for colors, typography, spacing, and animations
  - Implement glassmorphism card styles with backdrop blur
  - Add responsive breakpoints for mobile, tablet, and desktop
  - Define animation keyframes for fade, slide, and pulse effects
  - _Requirements: 4.1, 4.2, 4.3, 5.1_

- [x] 1.3 Create core JavaScript architecture with StateManager and APIClient classes
  - Implement StateManager with reactive state pattern and subscriber notifications
  - Build APIClient with retry logic and exponential backoff
  - Add error handling classes and custom error types
  - _Requirements: 1.4, 6.1, 6.2, 10.5_

- [ ]* 1.4 Write property test for input validation consistency
  - **Property 1: Input validation consistency**
  - **Validates: Requirements 1.2**

- [x] 2. Implement toast notification and modal systems
- [x] 2.1 Build toast notification component with animations
  - Create toast container and notification elements
  - Implement show/hide animations with auto-dismiss timers
  - Add support for success, error, warning, and info types
  - Style with glassmorphism effects and appropriate colors
  - _Requirements: 6.2, 6.4_

- [ ]* 2.2 Write property test for error notification display
  - **Property 12: Error notification display**
  - **Validates: Requirements 6.2**

- [ ]* 2.3 Write property test for success notification display
  - **Property 14: Success notification display**
  - **Validates: Requirements 6.4**

- [x] 2.4 Create modal dialog component for course creation and editing
  - Build modal overlay with backdrop blur
  - Implement modal content container with form fields
  - Add open/close animations with fade and scale effects
  - Implement focus trapping within modal
  - _Requirements: 1.1, 1.5_

- [ ]* 2.5 Write unit test for modal dialog behavior
  - Test modal opens when add button clicked
  - Test modal closes on cancel or backdrop click
  - Test focus trapping within modal
  - _Requirements: 1.1, 1.5_

- [-] 3. Build course management forms with validation
- [x] 3.1 Implement course creation form with inline validation
  - Create form fields for name, description, and dependencies
  - Add real-time validation with error messages
  - Implement dependency selection with multi-select dropdown
  - Style form with modern inputs and labels
  - _Requirements: 1.1, 1.2, 6.3_

- [ ]* 3.2 Write property test for inline validation feedback
  - **Property 13: Inline validation feedback**
  - **Validates: Requirements 6.3**

- [x] 3.3 Implement course update and delete functionality
  - Add edit mode to course modal with pre-filled data
  - Create confirmation dialog for delete actions
  - Implement API calls for update and delete operations
  - Add loading states during API requests
  - _Requirements: 1.3, 1.4, 1.5, 6.1_

- [ ]* 3.4 Write property test for loading indicators
  - **Property 11: Loading indicators for async operations**
  - **Validates: Requirements 6.1**

- [ ]* 3.5 Write property test for view synchronization
  - **Property 2: View synchronization on updates**
  - **Validates: Requirements 1.4**

- [x] 4. Implement local storage service for persistence
- [x] 4.1 Create StorageService class for managing local storage
  - Implement methods for saving and loading preferences
  - Add methods for completed courses tracking
  - Create pending changes queue for offline support
  - Add graph layout position storage
  - _Requirements: 10.1, 10.3, 10.4, 10.5_

- [ ]* 4.2 Write property test for preference persistence
  - **Property 26: Preference persistence**
  - **Validates: Requirements 10.1**

- [ ]* 4.3 Write property test for layout position persistence
  - **Property 28: Layout position persistence**
  - **Validates: Requirements 10.4**

- [ ]* 4.4 Write property test for offline change queuing
  - **Property 29: Offline change queuing**
  - **Validates: Requirements 10.5**

- [x] 4.5 Implement state restoration on application load
  - Load user preferences from local storage
  - Restore last view mode and filter settings
  - Load completed courses and graph layout positions
  - _Requirements: 10.3_

- [ ]* 4.6 Write unit test for state restoration
  - Test preferences are loaded correctly on init
  - Test view mode is restored from storage
  - Test completed courses are loaded
  - _Requirements: 10.3_

- [x] 5. Build list view with search and filters
- [x] 5.1 Create ListView component with course cards
  - Implement course card layout with glassmorphism styling
  - Display course name, description, and dependencies
  - Add completion checkbox to each card
  - Show course status indicators (available, locked, completed)
  - _Requirements: 7.1, 7.2, 9.4_

- [x] 5.2 Implement real-time search functionality
  - Create search input with debounced filtering
  - Filter courses by name and description (case-insensitive)
  - Highlight matching text in search results
  - Show empty state when no results found
  - _Requirements: 8.1, 8.2, 8.4_

- [ ]* 5.3 Write property test for search matching accuracy
  - **Property 20: Search matching accuracy**
  - **Validates: Requirements 8.1**

- [ ]* 5.4 Write property test for search highlight presence
  - **Property 21: Search highlight presence**
  - **Validates: Requirements 8.2**

- [ ]* 5.5 Write unit test for empty search state
  - Test empty state displays when no matches
  - Test helpful message is shown
  - _Requirements: 8.4_

- [x] 5.6 Add filter controls for course status
  - Create filter buttons for all, completed, available, and locked courses
  - Implement filter logic based on completion and dependency status
  - Update view when filters change
  - _Requirements: 7.5, 8.3_

- [ ]* 5.7 Write property test for filter application consistency
  - **Property 19: Filter application consistency**
  - **Validates: Requirements 7.5**

- [ ]* 5.8 Write property test for search restoration
  - **Property 23: Search restoration completeness**
  - **Validates: Requirements 8.5**

- [ ] 6. Implement course progress tracking
- [x] 6.1 Add completion status management to StateManager
  - Track completed courses in Set data structure
  - Implement toggle completion method
  - Persist completion status to backend API
  - Notify subscribers of completion changes
  - _Requirements: 7.1, 10.2_

- [ ]* 6.2 Write property test for completion state updates
  - **Property 15: Completion state updates**
  - **Validates: Requirements 7.1**

- [ ]* 6.3 Write property test for completion persistence
  - **Property 27: Completion persistence**
  - **Validates: Requirements 10.2**

- [x] 6.4 Build progress indicator component
  - Calculate overall completion percentage
  - Display progress bar with animated fill
  - Show completed/total course counts
  - Update in real-time as courses are completed
  - _Requirements: 7.3_

- [ ]* 6.5 Write property test for progress calculation accuracy
  - **Property 17: Progress calculation accuracy**
  - **Validates: Requirements 7.3**

- [x] 6.6 Implement course availability logic
  - Check if all dependencies are completed
  - Highlight available courses with distinct styling
  - Update availability when completion status changes
  - _Requirements: 7.4_

- [ ]* 6.7 Write property test for course availability logic
  - **Property 18: Course availability logic**
  - **Validates: Requirements 7.4**

- [-] 7. Create D3.js force-directed graph visualization
- [x] 7.1 Set up D3.js graph container and SVG elements
  - Create SVG container with responsive sizing
  - Initialize force simulation with appropriate forces
  - Set up zoom and pan behaviors
  - Add graph controls (reset, zoom in/out)
  - _Requirements: 2.1_

- [x] 7.2 Implement graph node rendering with course data
  - Create nodes for each course with circles and labels
  - Apply colors based on course status (completed, available, locked)
  - Add node styling with shadows and borders
  - Implement enter/update/exit pattern for data changes
  - _Requirements: 2.1, 4.4, 7.2_

- [ ]* 7.3 Write property test for graph structure correctness
  - **Property 3: Graph structure correctness**
  - **Validates: Requirements 2.1**

- [x] 7.4 Implement graph edge rendering for dependencies
  - Create directed edges (arrows) for each dependency
  - Style edges with appropriate colors and widths
  - Add markers for arrow heads
  - Update edges when nodes move
  - _Requirements: 2.1_

- [x] 7.5 Add node hover interactions with highlighting
  - Highlight hovered node with color change
  - Highlight all direct dependencies (incoming edges)
  - Highlight all dependents (outgoing edges)
  - Dim non-related nodes for focus
  - _Requirements: 2.2_

- [ ]* 7.6 Write property test for hover highlight correctness
  - **Property 4: Hover highlight correctness**
  - **Validates: Requirements 2.2**

- [x] 7.7 Implement node click interactions and detail panel
  - Center view on clicked node with smooth animation
  - Open side panel with course details
  - Display edit and delete buttons in panel
  - Close panel when clicking outside or on close button
  - _Requirements: 2.3_

- [ ]* 7.8 Write unit test for node click behavior
  - Test view centers on clicked node
  - Test detail panel opens with correct data
  - _Requirements: 2.3_

- [x] 7.9 Add drag functionality for node repositioning
  - Enable dragging of individual nodes
  - Maintain edge connections during drag
  - Update force simulation during drag
  - Save new positions to local storage
  - _Requirements: 2.4, 10.4_

- [ ]* 7.10 Write property test for drag maintains connectivity
  - **Property 5: Drag maintains connectivity**
  - **Validates: Requirements 2.4**

- [x] 7.11 Implement graph update animations
  - Animate node additions with fade-in
  - Animate node removals with fade-out
  - Smooth transition when dependencies change
  - Use appropriate easing functions
  - _Requirements: 2.5_

- [x] 8. Build timeline view with topological sorting
- [x] 8.1 Create TimelineView component structure
  - Set up timeline container with horizontal/vertical layouts
  - Create level containers for grouping courses
  - Add responsive layout switching for mobile
  - Style with modern card design
  - _Requirements: 3.1, 3.2, 5.5_

- [x] 8.2 Implement topological sort visualization
  - Fetch sorted courses from backend API
  - Group courses into levels based on dependencies
  - Display courses in correct order (dependencies first)
  - Show parallel courses in same level
  - _Requirements: 3.1, 3.2_

- [ ]* 8.3 Write property test for topological sort validity
  - **Property 6: Topological sort validity**
  - **Validates: Requirements 3.1**

- [ ]* 8.4 Write property test for level grouping independence
  - **Property 7: Level grouping independence**
  - **Validates: Requirements 3.2**

- [x] 8.5 Add timeline course cards with interactions
  - Display course information in timeline cards
  - Show completion status and availability
  - Add hover effects with highlighting
  - Implement click to view details
  - _Requirements: 3.3, 7.2_

- [x] 8.6 Implement cross-view highlight synchronization
  - Sync hover highlights between timeline and graph
  - Update both views when course is hovered
  - Maintain highlight state across view switches
  - _Requirements: 3.3_

- [ ]* 8.7 Write property test for cross-view synchronization
  - **Property 8: Cross-view highlight synchronization**
  - **Validates: Requirements 3.3**

- [x] 8.8 Add circular dependency error visualization
  - Detect circular dependencies from API errors
  - Highlight cycle nodes with pulsing animation
  - Display error message with affected courses
  - Prevent saving until cycle is resolved
  - _Requirements: 3.4, 6.5_

- [ ]* 8.9 Write unit test for circular dependency handling
  - Test cycle detection displays error
  - Test affected nodes are highlighted
  - _Requirements: 3.4_

- [x] 8.10 Create empty state for timeline view
  - Display engaging empty state when no courses
  - Show suggestions to add first course
  - Include call-to-action button
  - _Requirements: 3.5_

- [ ]* 8.11 Write unit test for empty timeline state
  - Test empty state renders correctly
  - Test suggestions are displayed
  - _Requirements: 3.5_

- [ ] 9. Implement view switching and synchronization
- [x] 9.1 Create view mode controls and navigation
  - Add view switcher buttons (graph, timeline, list)
  - Implement keyboard shortcuts for view switching (1, 2, 3)
  - Show active view indicator
  - Persist view mode preference to local storage
  - _Requirements: 10.1_

- [x] 9.2 Implement view synchronization logic
  - Ensure all views display same filtered/searched courses
  - Update all views when data changes
  - Maintain selection across view switches
  - Sync completion status across views
  - _Requirements: 1.4, 7.2, 8.3_

- [ ]* 9.3 Write property test for completed styling consistency
  - **Property 16: Completed styling consistency**
  - **Validates: Requirements 7.2**

- [ ]* 9.4 Write property test for filter synchronization
  - **Property 22: Filter synchronization across views**
  - **Validates: Requirements 8.3**

<!-- - [ ] 10. Add responsive design and mobile optimizations
- [ ] 10.1 Implement responsive layout breakpoints
  - Add media queries for mobile (< 768px), tablet, and desktop
  - Switch to stacked layout on mobile
  - Adjust graph and timeline sizing for different screens
  - Make modals full-screen on mobile
  - _Requirements: 5.1, 5.5_ -->

<!-- - [ ]* 10.2 Write unit test for mobile layout switching
  - Test layout changes at 768px breakpoint
  - Test stacked views on mobile
  - _Requirements: 5.1_ -->

<!-- - [ ] 10.3 Add touch-friendly controls for mobile
  - Increase tap target sizes to 44x44 pixels minimum
  - Add touch feedback animations
  - Implement swipe gestures for navigation
  - _Requirements: 5.2_ -->

<!-- - [ ]* 10.4 Write property test for mobile tap target sizing
  - **Property 9: Mobile tap target sizing**
  - **Validates: Requirements 5.2** -->

<!-- - [ ] 10.5 Implement pinch-to-zoom and pan for mobile graph
  - Add touch event handlers for pinch gestures
  - Implement two-finger pan for graph navigation
  - Add momentum scrolling for smooth feel
  - _Requirements: 5.3_ -->
<!-- 
- [ ]* 10.6 Write unit test for touch gesture support
  - Test pinch-to-zoom works on graph
  - Test pan gestures move graph
  - _Requirements: 5.3_

- [ ] 10.7 Ensure state preservation across layout changes
  - Maintain all state when switching between layouts
  - Preserve search query and filters
  - Keep selected course across breakpoints
  - _Requirements: 5.4_

- [ ]* 10.8 Write property test for state preservation
  - **Property 10: State preservation across layouts**
  - **Validates: Requirements 5.4** -->

<!-- - [ ] 11. Implement keyboard navigation and accessibility -->
<!-- - [ ] 11.1 Add keyboard navigation for interactive elements
  - Implement Tab/Shift+Tab for focus navigation
  - Add visible focus indicators with custom styling
  - Ensure logical tab order (top to bottom, left to right)
  - Trap focus within modals
  - _Requirements: 9.1_ -->
<!-- 
- [ ]* 11.2 Write property test for tab navigation order
  - **Property 24: Tab navigation order**
  - **Validates: Requirements 9.1** -->

<!-- - [ ] 11.3 Implement keyboard shortcuts for common actions
  - Add Enter to open course details
  - Add Escape to close modals and panels
  - Add Delete key for course deletion
  - Add Space to toggle completion
  - Add shortcuts for view switching (1, 2, 3)
  - _Requirements: 9.2_ -->

<!-- - [ ]* 11.4 Write unit test for keyboard shortcuts
  - Test Enter opens course details
  - Test Escape closes modals
  - Test view switching shortcuts work
  - _Requirements: 9.2_ -->

<!-- - [ ] 11.5 Add comprehensive ARIA labels and roles
  - Add aria-label to all buttons and interactive elements
  - Use role attributes for custom components
  - Add aria-live regions for dynamic content
  - Implement aria-describedby for form fields
  - _Requirements: 9.3_ -->
<!-- 
- [ ]* 11.6 Write property test for ARIA label completeness
  - **Property 25: ARIA label completeness**
  - **Validates: Requirements 9.3** -->

<!-- - [ ] 11.7 Create keyboard shortcuts help overlay
  - Build modal showing all available shortcuts
  - Trigger with question mark key
  - Group shortcuts by category
  - Style with modern design
  - _Requirements: 9.5_ -->
<!-- 
- [ ]* 11.8 Write unit test for help overlay
  - Test overlay opens with ? key
  - Test all shortcuts are listed
  - _Requirements: 9.5_ -->

- [ ] 12. Add animations and visual polish
- [ ] 12.1 Implement micro-animations for interactions
  - Add hover effects with scale and color transitions
  - Implement button press animations
  - Add ripple effects for clicks
  - Use appropriate timing functions and durations
  - _Requirements: 4.2, 4.5_

- [ ] 12.2 Add page transition animations
  - Implement fade-in for initial page load
  - Add slide animations for view switches
  - Animate modal open/close with scale and fade
  - Add smooth transitions for panel slides
  - _Requirements: 4.2_

- [ ] 12.3 Implement loading animations
  - Create spinner component for loading states
  - Add skeleton screens for content loading
  - Implement progress bars for long operations
  - Use subtle animations to indicate activity
  - _Requirements: 6.1_

- [ ] 12.4 Add success and error animations
  - Implement checkmark animation for success
  - Add shake animation for errors
  - Use color transitions for state changes
  - Add confetti or celebration for milestones
  - _Requirements: 6.2, 6.4_

<!-- - [ ] 13. Optimize performance
- [ ] 13.1 Implement debouncing and throttling
  - Debounce search input with 300ms delay
  - Throttle graph drag events to 60fps
  - Throttle window resize handlers
  - _Requirements: 8.1_ -->

<!-- - [ ] 13.2 Add performance optimizations for large datasets
  - Implement virtual scrolling for course lists > 100 items
  - Limit force simulation iterations for large graphs
  - Cache topological sort results
  - Memoize expensive calculations
  - _Requirements: 2.1, 3.1_ -->

<!-- - [ ]* 13.3 Write performance tests
  - Test graph renders in < 500ms for 50 nodes
  - Test search responds in < 100ms
  - Test view switches in < 200ms -->

- [-] 14. Final integration and testing
- [x] 14.1 Integrate all components into main application
  - Wire up all event handlers and state updates
  - Connect all views to StateManager
  - Ensure proper error handling throughout
  - Test all user flows end-to-end
  - _Requirements: All_

<!-- - [ ] 14.2 Cross-browser testing and fixes
  - Test in Chrome, Firefox, Safari, and Edge
  - Fix any browser-specific issues
  - Ensure consistent behavior across browsers
  - Test on different operating systems
  - _Requirements: All_ -->

<!-- - [ ] 14.3 Accessibility audit and fixes
  - Run automated accessibility tests
  - Test with screen readers (NVDA, JAWS, VoiceOver)
  - Verify keyboard navigation works completely
  - Fix any accessibility issues found
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_ -->

- [ ] 14.4 Write comprehensive integration tests
  - Test complete user workflows
  - Test error scenarios and recovery
  - Test offline functionality
  - Test data persistence

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
