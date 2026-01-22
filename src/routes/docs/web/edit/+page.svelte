<script lang="ts">
    import { CodeBlock } from '$lib/components/docs';
</script>

<h1>Edit View</h1>

<p>Feature tree and detail editing.</p>

<p>The Edit view is a two-pane layout for browsing and editing features.</p>

<h2>Feature tree (left panel)</h2>

<p>Your feature hierarchy with state indicators:</p>

<ul>
    <li>◇ <strong>Proposed:</strong> Idea in backlog</li>
    <li>○ <strong>In progress:</strong> Currently being worked</li>
    <li>● <strong>Implemented:</strong> Complete</li>
    <li>✗ <strong>Archived:</strong> Soft-deleted</li>
</ul>

<p>Click to select. Right-click for context menu.</p>

<h3>Context menu actions</h3>

<p><strong>For normal features:</strong></p>

<ul>
    <li><strong>Add Child Feature:</strong> Create a new feature under this one (making it a chapter)</li>
    <li><strong>Archive:</strong> Soft-delete the feature</li>
</ul>

<p><strong>For archived features:</strong></p>

<ul>
    <li><strong>Restore:</strong> Return the feature to proposed state</li>
    <li><strong>Delete Permanently:</strong> Remove from database (cannot be undone)</li>
</ul>

<h3>Chapters</h3>

<p>
    Features with children are called chapters. They organize related features into groups.
    When you add a child to a leaf feature, it becomes a chapter.
</p>

<h2>Feature detail (right panel)</h2>

<p>Edit the selected feature:</p>

<ul>
    <li><strong>Title:</strong> Short feature name</li>
    <li><strong>State:</strong> Current feature state</li>
    <li><strong>Details:</strong> Markdown editor for specs</li>
</ul>

<h3>Feature details format</h3>

<p>Use markdown in the details field:</p>

<CodeBlock language="markdown" code={`## User story
As a user, I can sign in with my Google account.

## Acceptance criteria
- [ ] Google OAuth button on login page
- [ ] Creates account on first login
- [ ] Links to existing account if email matches

## Technical notes
- Use passport-google-oauth20
- Store refresh tokens securely`} />
