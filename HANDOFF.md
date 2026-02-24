# [Project Name] - Handoff Document

**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD HH:MM UTC
**Status:** [Current phase - e.g., "Ready for Testing", "In Development", "Blocked on X"]
**Previous Handoff:** [Link to prior handoff document if exists]

---

## QUICK STATE

```
┌─────────────────────────────────────────────────────────────┐
│  WORKING DIRECTORY: /path/to/project                        │
│  REPOSITORY: https://github.com/org/repo                    │
│  BRANCH: current-branch-name                                │
│  BUILD STATUS: [✓ Passing / ✗ Failing - see notes]          │
│  TEST STATUS: [✓ Passing / ✗ Failing - see notes]           │
│  LAST VERIFIED: YYYY-MM-DD HH:MM                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ACTIVE WORK

### Current Focus

**What is being worked on right now:**
<!-- One or two sentences describing the active task -->

**Why this task:**
<!-- Context for why this task was prioritized -->

**Blockers (if any):**
<!-- What's preventing progress -->

**Next immediate steps:**
1. [First concrete action]
2. [Second concrete action]
3. [Third concrete action]

---

## COMPLETED THIS SESSION

### ✓ [Feature/Task Name]

#### What It Is

<!-- Plain language description of the feature or change -->

#### How It Works

<!-- Technical explanation of the implementation. Include diagrams if helpful. -->

#### Files Modified

| File | Change | Line |
|------|--------|------|
| `path/to/file.go` | Added X function | :123 |
| `path/to/other.go` | Modified Y logic | :456 |

#### How to Verify

```bash
# Commands to verify this feature works
```

#### Edge Cases / Known Limitations

<!-- Document any edge cases handled or known limitations -->

---

## LOST CONTEXT INSURANCE

> **PURPOSE:** This section captures contextual knowledge that is typically lost during compaction. It records not just what was done, but what was considered, rejected, and why. This is the most critical section for continuity.

### Decision Log

| Date | Decision | Alternatives Considered | Why Chosen | Who/What Influenced |
|------|----------|------------------------|------------|---------------------|
| YYYY-MM-DD | [Decision made] | [Option A, Option B, Option C] | [Rationale] | [User preference, time constraint, etc.] |

<!-- Example:
| 2026-02-20 | Used F1 for accept suggestion | Tab (conflict), Ctrl+Enter, Ctrl+Space | Tab occupied by focus-switch, F1 available and intuitive | User explicitly requested F1 |
-->

### Rejected Approaches

**Problem:** [What problem were you trying to solve]

| Approach | Why Tried | Why Rejected | Lessons Learned |
|----------|-----------|--------------|-----------------|
| [Approach A] | [Reasoning] | [Why it didn't work] | [What was learned] |
| [Approach B] | [Reasoning] | [Why it didn't work] | [What was learned] |

<!-- CRITICAL: Document approaches that ALMOST worked but failed. This prevents
     future agents from re-treading the same dead-end paths. Include:
     - Partial solutions that worked but had fatal flaws
     - Approaches that seemed correct but had subtle issues
     - Solutions that worked in isolation but failed in integration
-->

### Debugging History

**Issue:** [Brief description of the bug/issue]

**Symptoms:**
<!-- Observable behavior -->

**Root Cause:**
<!-- What was actually wrong -->

**Discovery Path:**
1. First hypothesis: [What you thought it was] → Result: [What happened]
2. Second hypothesis: [What you thought next] → Result: [What happened]
3. Final hypothesis: [What it actually was] → Result: [Fixed]

**Key Insight:**
<!-- The non-obvious thing that solved it -->

### User Preferences & Working Style

**Communication Style:**
<!-- How does the user prefer information presented?
     - Concise vs. detailed
     - Code-first vs. explanation-first
     - Prefers diagrams or text
-->

**Decision Authority:**
<!-- What decisions can the agent make autonomously vs. what requires user approval?
     - Can refactor without asking
     - Must confirm before any database changes
     - Etc.
-->

**Priority Calibration:**
<!-- How does the user trade off:
     - Speed vs. correctness
     - Simple vs. complete
     - Progress vs. perfect
-->

**Known Pain Points:**
<!-- What frustrates the user? What should be avoided? -->

### Environment Specifics

**Provider/Model Notes:**
<!-- Any provider-specific behaviors discovered:
     - ZAI/GLM-5 has unusual caching behavior
     - Anthropic handles tool results differently
     - Model X has smaller context window than documented
-->

**Infrastructure Quirks:**
<!-- Environment-specific gotchas:
     - Database A is 97MB, requires special migration care
     - Service B has a memory leak, needs restart every N hours
     - Path C is case-sensitive on this system
-->

**Configuration State:**
<!-- Non-obvious configuration that affects behavior:
     - Feature flags currently enabled
     - Experimental settings in use
     - Custom configurations that differ from defaults
-->

### Partially Complete Work

**Item:** [What is incomplete]

**Status:** [Percentage complete or phase reached]

**What's Done:**
- [Completed piece 1]
- [Completed piece 2]

**What's Remaining:**
- [ ] [Remaining piece 1]
- [ ] [Remaining piece 2]

**Why It Stopped:**
<!-- Critical: Why did work stop here? This prevents future agents from
     assuming it was forgotten and restarting from scratch.
     - Blocked on external dependency
     - Priority shifted
     - Design decision needed from user
     - Discovered deeper issue
-->

**Resume Instructions:**
<!-- Specific instructions for continuing this work -->

### Open Questions

**Question:** [Unresolved question]
- **Context:** [Why this matters]
- **Options:** [Possible answers]
- **Impact:** [What depends on this decision]
- **Blocking:** [Is this blocking anything?]

---

## FEATURE INVENTORY

### Completed Features

| Feature | Status | Files | Health Check |
|---------|--------|-------|--------------|
| [Feature 1] | ✓ Done | `path/to/file.go` | `[verification command]` |
| [Feature 2] | ✓ Done | `path/to/file.go` | `[verification command]` |

### In Progress

| Feature | Status | Blocking | ETA |
|---------|--------|----------|-----|
| [Feature 3] | In Development | None | [Estimate] |

### Planned / Design Only

| Feature | Status | Notes |
|---------|--------|-------|
| [Feature 4] | Design Complete | Ready for implementation |
| [Feature 5] | Spec Needed | Waiting on requirements |

---

## VERIFICATION PROCEDURES

### Build Verification

```bash
# Standard build command
[build command]

# Expected output:
[expected output or success indicator]
```

### Test Verification

```bash
# Run all tests
[test command]

# Run specific test suite
[specific test command]

# Coverage check
[coverage command]
```

### Integration Verification

```bash
# Integration test or manual verification steps
```

### Health Check Commands

```bash
# Quick checks to verify system health
[command 1]
[command 2]
[command 3]
```

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| [Risk description] | [Low/Med/High] | [Low/Med/High] | [How to address] | [Who handles] |

---

## ARCHITECTURE NOTES

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [ASCII diagram of system architecture]                     │
│                                                             │
│  [Include key components and their relationships]           │
└─────────────────────────────────────────────────────────────┘
```

### Key Dependencies

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| [package] | [version] | [what it does] | [any quirks] |

### Data Flow

```
[Diagram or description of how data moves through the system]
```

---

## SESSION METADATA

**Session Duration:** 6h 36m
**Compaction Count:** [Number of times context was compacted]
**Primary Focus:** [Main area of work this session]
**Secondary Items:** [Other things addressed]

### Files Modified This Session

```
[git diff --stat or manual list]
```

### Uncommitted Changes

```
[git status --short or description of pending changes]
```

---

## HANDOFF CHECKLIST

Before finalizing this handoff:

- [ ] All "LOST CONTEXT INSURANCE" sections are filled
- [ ] Decision Log has all significant decisions from this session
- [ ] Rejected Approaches documents failed attempts
- [ ] User Preferences updated if new preferences discovered
- [ ] Partially Complete Work explains why each item stopped
- [ ] Verification Procedures tested and passing
- [ ] Build status is current
- [ ] Next session's "Current Focus" is clear and actionable

---

## APPENDIX: RAW NOTES

<!-- Unstructured notes that may be useful but don't fit elsewhere.
     Include things like:
     - Commands run during debugging
     - Interesting error messages encountered
     - Links to relevant documentation
     - Slack/Discord conversations summary
     - Git commit hashes of interest
-->

---

*This handoff document follows the Floyd Handoff Template v1.0*
*Template location: templates/HANDOFF_TEMPLATE.md*
