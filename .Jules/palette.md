## 2024-05-18 - [Spinner Feedback Component] **Learning:** Adding an SVG-based spinner (with a fast continuous CSS animation) clearly grounds latency-heavy features (like AI generations or board re-organization) and gives users visual closure that the app is working, without needing complex UI toolkits or libraries. **Action:** Next time looking to add feedback, consider reusable SVG components + `@keyframes` over heavy React library integrations to keep PRs <50 lines and preserve performance.
## 2024-05-18 - Empty State Cards
**Learning:** Empty states are a common micro-UX oversight. Replacing generic "no results" text with contextual cards (differentiating between "no search results", "no filtered results", and "no items at all") with matching icons (🔍, 🎛️, 📝) provides significantly better user guidance and visual polish without requiring new components.
**Action:** Always check for plain text empty states in list views and upgrade them to use the `empty-state-card` pattern with contextual messaging.
## 2024-05-18 - [Button Interaction Polish]
**Learning:** Hardcoded inline styles on interactive elements (like the Copy Ticket button) prevent crucial visual feedback states (`:hover`, `:active`), making the UI feel rigid.
**Action:** Always extract recurring utility buttons to the central stylesheet (e.g., `index.css`) to enforce uniform `:hover` and `:active` transitions, maintaining the app's overall "calm and pleasant" interactive feel.
## 2024-05-18 - Inline delete confirmation
**Learning:** Users often click destructive action buttons by accident. Adding a simple, inline confirmation toggle before triggering the deletion is less intrusive than a full modal dialog and provides immediate context.
**Action:** I will consider adding inline confirmations for destructive actions to avoid the use of obtrusive native modals or overlays whenever appropriate.
