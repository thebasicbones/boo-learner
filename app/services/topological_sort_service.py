"""Topological Sort Service for dependency ordering and cycle detection"""

from collections import deque

from app.exceptions import CircularDependencyError


class TopologicalSortService:
    """Service for topological sorting and circular dependency detection using Kahn's algorithm"""

    @staticmethod
    def topological_sort(resources: list[dict]) -> list[dict]:
        """
        Sort resources in topological order using Kahn's algorithm.
        Dependencies appear before dependents in the result.

        Args:
            resources: List of resource dictionaries with 'id' and 'dependencies' fields

        Returns:
            List of resources in topological order

        Raises:
            CircularDependencyError: If a circular dependency is detected
        """
        if not resources:
            return []

        # Build adjacency list and in-degree map
        graph = {}  # resource_id -> list of dependent resource_ids
        in_degree = {}  # resource_id -> count of dependencies
        resource_map = {}  # resource_id -> resource dict

        # Initialize all resources
        for resource in resources:
            resource_id = resource["id"]
            resource_map[resource_id] = resource
            graph[resource_id] = []
            in_degree[resource_id] = 0

        # Build the graph
        for resource in resources:
            resource_id = resource["id"]
            dependencies = resource.get("dependencies", [])

            for dep_id in dependencies:
                # Only process dependencies that exist in our resource set
                if dep_id in resource_map:
                    graph[dep_id].append(resource_id)
                    in_degree[resource_id] += 1

        # Find all nodes with in-degree 0 (no dependencies)
        queue = deque([rid for rid, degree in in_degree.items() if degree == 0])
        result = []

        # Process nodes in topological order
        while queue:
            current_id = queue.popleft()
            result.append(resource_map[current_id])

            # Reduce in-degree for all dependents
            for dependent_id in graph[current_id]:
                in_degree[dependent_id] -= 1
                if in_degree[dependent_id] == 0:
                    queue.append(dependent_id)

        # If we didn't process all nodes, there's a cycle
        if len(result) != len(resources):
            cycle_path = TopologicalSortService._find_cycle(graph, in_degree)
            raise CircularDependencyError(cycle_path)

        return result

    @staticmethod
    def _find_cycle(graph: dict[str, list[str]], in_degree: dict[str, int]) -> list[str]:
        """
        Find a cycle in the graph using DFS.

        Args:
            graph: Adjacency list representation
            in_degree: In-degree map (nodes with in_degree > 0 are part of cycles)

        Returns:
            List of resource IDs forming a cycle
        """
        # Find nodes that are part of the cycle (in_degree > 0)
        cycle_nodes = {rid for rid, degree in in_degree.items() if degree > 0}

        if not cycle_nodes:
            return []

        # Use DFS to find the actual cycle path
        visited = set()
        rec_stack = []

        def dfs(node: str) -> list[str] | None:
            if node in rec_stack:
                # Found a cycle - return the cycle path
                cycle_start_idx = rec_stack.index(node)
                return rec_stack[cycle_start_idx:] + [node]

            if node in visited:
                return None

            visited.add(node)
            rec_stack.append(node)

            # Only follow edges within the cycle nodes
            for neighbor in graph.get(node, []):
                if neighbor in cycle_nodes:
                    cycle = dfs(neighbor)
                    if cycle:
                        return cycle

            rec_stack.pop()
            return None

        # Start DFS from any node in the cycle
        for start_node in cycle_nodes:
            if start_node not in visited:
                cycle = dfs(start_node)
                if cycle:
                    return cycle

        # Fallback: return any cycle nodes if DFS didn't find a path
        return list(cycle_nodes)[:2] + [list(cycle_nodes)[0]]

    @staticmethod
    def validate_no_cycles(
        resources: list[dict], new_resource_id: str, new_dependencies: list[str]
    ) -> None:
        """
        Validate that adding/updating a resource with given dependencies won't create a cycle.

        Args:
            resources: Existing resources in the system
            new_resource_id: ID of the resource being created/updated
            new_dependencies: List of dependency IDs for the new/updated resource

        Raises:
            CircularDependencyError: If the operation would create a cycle
        """
        # Build a temporary graph including the proposed changes
        temp_resources = []

        # Add existing resources (excluding the one being updated if it exists)
        for resource in resources:
            if resource["id"] != new_resource_id:
                temp_resources.append(resource)

        # Add the new/updated resource
        temp_resources.append({"id": new_resource_id, "dependencies": new_dependencies})

        # Try to sort - will raise CircularDependencyError if cycle exists
        TopologicalSortService.topological_sort(temp_resources)
