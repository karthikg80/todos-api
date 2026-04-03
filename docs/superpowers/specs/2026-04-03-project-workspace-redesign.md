# Project Workspace Redesign

**Date:** 2026-04-03
**Client:** React (`client-react/`)
**Approach:** Give selected projects a dedicated workspace surface instead of rendering them as a filtered generic task list.

## Problem

The current selected-project route reuses the same header and list stack as Everything, Today, and Horizon. The result is functionally correct but weak as product design: a project feels like "the same list with one more filter" instead of a place for structured work.

## Product Direction

- `Everything` remains the inventory view.
- `Today` remains the day-shaping view.
- `Project` becomes a workspace for one body of work.

The selected-project experience should default to an opinionated workspace with its own visual identity and information hierarchy. Dense task-list controls still exist, but they become a subordinate mode rather than the default identity of the view.

## First-Pass UX

### Modes

The project workspace ships with three local modes:

1. `Overview`
2. `Sections`
3. `Tasks`

`Overview` is the default. The chosen mode is local to the project workspace and should restore when the view is cached by `ViewRouter`.

### Overview

The overview surface is the landing state for a project. It uses a hero card instead of the generic app header and answers these questions quickly:

- What is this project?
- How healthy is it?
- What should move next?
- Where is the messy work hiding?

The first pass includes:

- project hero with name, description, status, target date, area, and progress
- a compact metrics strip: open, complete, overdue, unplaced
- `Next up` panel for strongest candidate tasks
- `Risks` panel for overdue / waiting / blocked work
- `Loose ends` panel for unsorted or inbox-ish project work
- `Sections` summary cards so headings feel like chapters instead of pills
- `Recent movement` panel from recently updated tasks

### Sections

The sections mode treats headings as the primary organizational unit.

- Every heading renders as a full card with task count and health hints.
- Tasks with no heading appear in a dedicated `Unplaced work` card.
- Each section card shows a small sample of tasks and an explicit action that jumps into the tasks mode filtered to that section.

This reinforces the idea that headings are structural, not decorative.

### Tasks

Tasks mode keeps the dense operational tools:

- quick entry
- heading tabs
- task search
- filters
- bulk actions
- board/list toggle
- grouped list rendering

This mode intentionally reuses the existing list and board implementations, but it is visually nested under the project workspace rather than defining the whole page.

## Architecture

### New Component

Add a dedicated `ProjectWorkspaceView` component under `client-react/src/components/projects/`.

Responsibilities:

- render project-specific hero and mode chrome
- fetch and own heading data for the selected project
- compose overview / sections / tasks presentations
- keep project-specific snapshot state (scroll + local mode)

### AppShell Integration

`AppShell` should stop rendering selected projects through `ListViewHeader + SortableTodoList`. Instead, the dynamic `project:${projectId}` route renders `ProjectWorkspaceView`.

Non-project list views continue using `ListViewHeader`.

### Heading Data

Extract heading fetching into a reusable hook so project surfaces can share one source of truth:

- `useProjectHeadings(projectId)`

This avoids duplicate fetch logic between the workspace shell and task editing surfaces.

## Non-goals

- redesigning the sidebar rail
- changing backend project APIs
- replacing the existing list/board renderers
- adding project-only persistence beyond local view state

## Files

- `client-react/src/components/projects/ProjectWorkspaceView.tsx`
- `client-react/src/hooks/useProjectHeadings.ts`
- `client-react/src/components/projects/ProjectHeadings.tsx`
- `client-react/src/components/layout/AppShell.tsx`
- `client-react/src/components/layout/ListViewHeader.tsx`
- `client-react/src/styles/app.css`

