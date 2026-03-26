# Product Overview

This repo currently ships a planning-focused task workspace, not just a CRUD todo API.

## What It Is

Todos combines:

- a static single-page frontend for daily task management
- an Express + Prisma backend for auth, tasks, projects, planning, and feedback workflows
- AI-assisted planning surfaces across the app
- an internal `/agent` surface for automation and machine-usable workflows
- a public `/mcp` surface for assistant connectors such as ChatGPT, Claude, and similar clients

## User-Facing Features

### Core task management

- tasks with status, priority, due/start/scheduled/review dates, tags, notes, recurrence, waiting state, dependencies, and subtasks
- projects with nested paths, headings/sections, metadata, and archive state
- quick entry with natural-language date parsing
- desktop and mobile task drawer editing

### Planning workflow

- Home dashboard with focus-oriented tiles
- today's plan generation
- upcoming work views
- rescue mode / day-context affordances
- weekly review with findings, suggested cleanup, and next-week anchors

### AI-assisted workflow

- on-create guidance while drafting a task
- task-drawer suggestions for improving or restructuring work
- brain-dump to plan drafting
- home priorities brief and home focus suggestions
- suggestion history, feedback, and basic insight surfaces

### Capture and feedback

- inbox capture flow for unstructured items
- promote/discard/triage flow for inbox items
- product feedback submission UI
- admin review and promotion workflows for feedback requests

### Auth and account

- JWT auth with refresh-token rotation
- email verification and password reset
- admin bootstrap
- optional Google, Apple, and phone login flows

## Machine-Facing Surfaces

### REST + app APIs

- `/todos`
- `/projects`
- `/users`
- `/preferences`
- `/capture`
- `/feedback`
- `/admin`

### AI and planning APIs

- `/ai` for decision assist, plan drafting, priorities brief, suggestion history, feedback summary, and related flows

### Internal agent surface

- `/agent` for task/project actions, planning, inbox operations, control-plane tasks, metrics, recommendation feedback, day context, and learning loops

### Public assistant surface

- `/mcp` for Streamable HTTP / SSE MCP transport
- `/oauth` and `/.well-known/*` for assistant OAuth and protected-resource discovery

## Current Strengths

- stronger planning and review workflows than a typical todo app
- unusually capable assistant / MCP backend for a personal task product
- rich task metadata model already present in the backend
- strong automated coverage on the frontend interaction surface

## Current Limits

- the product is stronger on prioritization and planning than on full scheduling/timeboxing
- some advanced backend capabilities are more visible through `/agent` and MCP than through the end-user UI
- assistant connectivity is operationally capable, but the in-app management experience still has room to become more polished

## Where To Read Next

- [README.md](../README.md)
- [Assistant MCP](assistant-mcp.md)
- [Planner Runtime](planner-runtime.md)
- [Architecture Current State](architecture/current-state.md)
