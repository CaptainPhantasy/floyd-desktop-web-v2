# TypeScript Cleanup Specialist — Deterministic Prompt

**Created:** 2026-02-28 14:10:00 UTC  
**Project:** FloydDesktopWeb-v2 Multimedia Studio Refactor  
**Purpose:** Fix all TypeScript compilation errors before Phase 2 begins

---

## CONTEXT

You are a TypeScript Cleanup Specialist. Your job is to fix all TypeScript compilation errors in the FloydDesktopWeb-v2 project so that `npx tsc --noEmit` returns **0 errors**.

### Project State

- **Phase 1 is complete** — New files created in `server/src/`
- **19 TypeScript errors exist** — All are pre-existing (not from Phase 1)
- **Server runs** — Runtime works despite type errors
- **Goal:** Clean build for Phase 2 foundation

### Files Modified in Phase 1 (DO NOT BREAK THESE)

| File | Purpose | Status |
|------|---------|--------|
| `server/src/provider-router.ts` | Routes to optimal models | ✅ Working |
| `server/src/multimedia-api.ts` | Image/video/audio generation | ✅ Working |
| `server/index.ts` (lines 25, 114-116, 530-900) | New endpoints and imports | ✅ Working |

**CRITICAL:** Your fixes must not break the functionality added in Phase 1. The new code ranges are:
- Line 25: `import { multimediaAPI } from './src/multimedia-api.js'`
- Lines 114-116: Settings interface with `openaiApiKey`, `elevenLabsApiKey`, `zaiApiKey`
- Lines 530-900: New diagnostic endpoints and test-key providers

---

## CURRENT ERROR STATE

Run this command to see all errors:
```bash
npx tsc --noEmit 2>&1 | grep "error TS"
```

### Known Error Categories

#### Category 1: `attachments` property missing from `Message` type

```
server/index.ts(1880,11): error TS2353: 'attachments' does not exist in type 'Message'
server/index.ts(2101,34): error TS2339: Property 'attachments' does not exist
server/index.ts(2101,51): error TS2339: Property 'attachments' does not exist
server/index.ts(2103,36): error TS2339: Property 'attachments' does not exist
server/index.ts(2207,5):  error TS2353: 'attachments' does not exist in type 'Message'
server/index.ts(2328,34): error TS2339: Property 'attachments' does not exist
server/index.ts(2328,51): error TS2339: Property 'attachments' does not exist
server/index.ts(2330,36): error TS2339: Property 'attachments' does not exist
server/index.ts(2434,5):  error TS2353: 'attachments' does not exist in type 'Message'
```

**Root Cause:** The `Message` interface at ~line 82-86 does not include `attachments` property, but the code uses it.

**Fix Approach:** Add `attachments` property to the Message interface:

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    data?: string;  // base64
    path?: string;
  }>;
}
```

#### Category 2: Tool name type mismatches

```
server/index.ts(2106,9): error TS2322: Type 'string' not assignable to tool name union
server/index.ts(2107,9): error TS2322: Type 'string' not assignable to tool description
server/index.ts(2130,9): error TS2322: Type 'string' not assignable to tool description
server/index.ts(2131,9): error TS2322: Type 'Record<string, unknown>' not assignable
```

**Root Cause:** Tool definitions are using generic `string` types instead of the specific union types expected by the MCP/Browork tool schemas.

**Fix Approach:** Either:
1. Cast the tool definitions to `any` for dynamic tools, OR
2. Define proper typed tool schemas matching the expected union

#### Category 3: DOM reference in server code

```
server/tool-executor.ts(1236,26): error TS2584: Cannot find name 'document'
server/tool-executor.ts(1239,16): error TS2584: Cannot find name 'document'
```

**Root Cause:** `server/tool-executor.ts` references `document` which is a browser-only global.

**Fix Approach:** These may be in dead code paths. Check if this code runs server-side. If so, wrap in `typeof document !== 'undefined'` check or remove if dead code.

---

## EXECUTION PROTOCOL

### Step 1: Document Current State
```bash
# Count errors before starting
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Save full error list
npx tsc --noEmit 2>&1 > /tmp/typescript-errors-before.txt
```

### Step 2: Fix Category 1 (Message.attachments)

1. View the `Message` interface definition:
   ```bash
   grep -n "interface Message" server/index.ts
   ```

2. View the interface and surrounding code (typically lines 80-100)

3. Add `attachments` property to the interface

4. Verify: `npx tsc --noEmit 2>&1 | grep "attachments" | wc -l` should return 0

### Step 3: Fix Category 2 (Tool type mismatches)

1. View the error locations (lines 2106, 2107, 2130, 2131)

2. Determine the correct type approach:
   - If these are dynamically constructed tools, use type assertion
   - If these should be typed, import and use the proper types

3. Apply fix

4. Verify: `npx tsc --noEmit 2>&1 | grep -E "2106|2107|2130|2131" | wc -l` should return 0

### Step 4: Fix Category 3 (DOM references)

1. View `server/tool-executor.ts` lines 1230-1245

2. Determine if code is dead or needs guard:
   ```typescript
   if (typeof document !== 'undefined') {
     // browser-only code
   }
   ```

3. Apply fix

4. Verify: `npx tsc --noEmit 2>&1 | grep "document" | wc -l` should return 0

### Step 5: Final Verification

```bash
# Run full compilation
npx tsc --noEmit

# Expected: No errors
# Exit code should be 0

# Save success state
echo "TypeScript cleanup complete: $(date -u)" > /tmp/typescript-cleanup-complete.txt
```

### Step 6: Runtime Verification

After fixing all TypeScript errors, verify the server still works:

```bash
# Start server
npx tsx server/index.ts &
sleep 12

# Test endpoints
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/settings
curl -s http://localhost:3001/api/diagnostic/openai-image
curl -s http://localhost:3001/api/diagnostic/elevenlabs

# Stop server
pkill -f "tsx server"
```

All endpoints should return valid JSON.

---

## CONSTRAINTS

1. **NO SUB-AGENTS** — Do not use the Agent tool (it freezes)
2. **DO NOT BREAK Phase 1 code** — Lines 25, 114-116, 530-900 in server/index.ts
3. **DO NOT DELETE functionality** — Only fix types
4. **MINIMAL CHANGES** — Fix only what's necessary for clean build
5. **PRESERVE RUNTIME** — Server must still work after fixes

---

## SUCCESS CRITERIA

| Criteria | Verification |
|----------|--------------|
| Zero TypeScript errors | `npx tsc --noEmit` exits 0 |
| Server starts | `npx tsx server/index.ts` runs without crash |
| Health endpoint works | `/api/health` returns `{"status":"ok"}` |
| Phase 1 endpoints work | `/api/diagnostic/openai-image` returns JSON |
| Settings endpoint works | `/api/settings` includes `hasOpenaiApiKey` etc. |

---

## REPORTING

When complete, report:

```
## TypeScript Cleanup Complete

**Timestamp:** YYYY-MM-DD HH:MM:SS UTC

### Errors Fixed
| Category | Count | Fix Applied |
|----------|-------|-------------|
| Message.attachments | X | Added attachments property |
| Tool type mismatches | X | Applied type assertions |
| DOM references | X | Added typeof guards |

### Verification Results
- TypeScript compilation: ✅ 0 errors
- Server startup: ✅ OK
- /api/health: ✅ OK
- /api/diagnostic/openai-image: ✅ OK
- /api/diagnostic/elevenlabs: ✅ OK
- /api/settings: ✅ OK

### Files Modified
- server/index.ts (lines X-Y)
- server/tool-executor.ts (lines X-Y)

### Ready for Phase 2: YES
```

---

## IF YOU ENCOUNTER ISSUES

1. **More errors than expected:** Document them and fix in order
2. **Runtime breaks after fix:** Revert and try alternative approach
3. **Cannot determine fix:** Report the specific error and ask for guidance

---

**END OF PROMPT**

*This prompt is self-contained and deterministic. Execute each step in order.*
