# GitHub Actions Workflows

## Status: LOCAL DEVELOPMENT ONLY

The workflows in this directory are designed for local development with FloydDesktopWeb running on `localhost:3001`. 

**These workflows will NOT work in GitHub Actions** because:
- They depend on FloydDesktopWeb being accessible via hardcoded localhost URLs
- They require local MCP servers to be running
- They access hardcoded paths (`/Volumes/Storage/FloydDesktopWeb-v2`)

## Workflows

- `safe-ops-impact-simulation.yml` - Simulate impact of PR changes
- `safe-ops-refactor.yml` - Verify refactor operations
- `safe-ops-post-merge.yml` - Post-merge validation

## Usage

To use these workflows locally:

1. Start FloydDesktopWeb:
   ```bash
   cd /Volumes/Storage/FloydDesktopWeb-v2
   npm start
   ```

2. Verify MCP servers are connected:
   ```bash
   curl http://localhost:3001/api/mcp/status
   ```

3. Run workflow simulation manually (extract steps and execute locally)

## Production CI/CD

For production GitHub Actions, workflows need to be redesigned to either:
- Option A: Containerize FloydDesktopWeb and deploy as a service
- Option B: Use native GitHub Actions instead of MCP tool calls
- Option C: Use Floyd CLI directly instead of MCP layer

See audit report Violation #5 for details.
