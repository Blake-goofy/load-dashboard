# Load Dashboard Fix

## Issue Description
Users experience a hanging load animation on the dashboard page (`/scale/trans/dashboard`). 
- **Symptoms**: The network calls complete quickly (~1 second), but the loading spinner (`#loadspinner`) and screen fade (`#screenfade`) persist, or the spinner restarts after the initial load.
- **Impact**: The widget information (or "No widgets" message) is hidden behind the spinner until some internal timeout or secondary event eventually clears it.

## Technical Explanation & Hypothesis
The dashboard uses **Knockout.js** for data binding. The visibility of the spinner and the content is controlled by a Knockout observable named `_loadSpinner`.

- **Hypothesis**: The application likely has a logic gap where the `_loadSpinner` observable is set to `true` (loading) but fails to be set back to `false` immediately after the critical network requests complete. It might be waiting for a secondary event that never fires or fires very late. Alternatively, a race condition causes the observable to flip back to `true` erroneously after the initial load.
- **Evidence**: Network logs show requests finishing rapidly, yet the UI remains blocked. Debugging shows the `_loadSpinner` observable stays `true` even when traffic is idle.

## Solution: Tampermonkey Script
The script mitigates this by aggressively synchronizing the UI state with the actual network state.

### Key Features
1. **Network Monitoring**: 
   - Hooks into `window.fetch` and `XMLHttpRequest` to track active network requests in real-time.
   - Maintains a counter of `activeRequests`.

2. **Smart State Enforcement**:
   - When the network becomes idle (`activeRequests === 0`), the script automatically forces the `_loadSpinner` observable to `false`.
   - This instantly reveals the dashboard content.

3. **Reactive Guard**:
   - Subscribes to the `_loadSpinner` observable.
   - If the application tries to set `_loadSpinner` to `true` while the network is idle (no active requests), the script immediately intercepts this and flips it back to `false`.

### Use
Install the `main.user.js` script in Tampermonkey. It runs automatically on the dashboard page.
- **Debug Mode**: Toggle `CONFIG.debug = true` in the script to see detailed logs in the browser console about network tracking and spinner state changes.
