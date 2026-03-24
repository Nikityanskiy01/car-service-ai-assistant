<!--
Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles:
  - PRINCIPLE_1_NAME -> I. Client-Server and Stack Integrity
  - PRINCIPLE_2_NAME -> II. Role-Centered Product Behavior
  - PRINCIPLE_3_NAME -> III. Structured AI Diagnostics
  - PRINCIPLE_4_NAME -> IV. Security and Data Protection Baseline
  - PRINCIPLE_5_NAME -> V. Test and Quality Gates
- Added sections:
  - Product and Interface Constraints
  - Delivery and Operational Rules
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ⚠ pending: .specify/templates/commands/*.md (directory not present in repository)
- Follow-up TODOs:
  - None
-->
# AI assistant for automating the primary consultation process of car service clients Constitution

## Core Principles

### I. Client-Server and Stack Integrity
The system MUST preserve a client-server architecture with a responsive web frontend, a
Node.js modular backend, REST API communication, PostgreSQL persistence for all
consultation sessions and generated requests, and a locally deployed LLM for natural
language processing. Changes that bypass these stack constraints MUST NOT be merged unless
the constitution is formally amended first.

### II. Role-Centered Product Behavior
The product MUST support exactly three operational roles (client, manager,
administrator) with explicit RBAC boundaries and complete role-specific workflows. Each
feature specification MUST identify affected roles and define acceptance criteria that prove
role capabilities and restrictions, including prevention of unauthorized access.

### III. Structured AI Diagnostics
The consultation assistant MUST conduct dialog-based vehicle diagnostics that extract and
persist structured parameters (make, model, year, mileage, symptoms, driving conditions),
identify missing information, generate clarification questions, and produce structured
outcomes (probable failures with percentages, confidence score, and estimated service cost
range). Service request generation from completed consultations MUST be supported and stored
for manager operations.

### IV. Security and Data Protection Baseline
JWT authentication, role-based authorization, strict input validation, and baseline
protection against XSS and SQL injection are non-negotiable. All external and internal
interfaces MUST reject unauthorized operations, and data handling paths for consultations,
diagnostic summaries, and service requests MUST be auditable and consistently validated.

### V. Test and Quality Gates
Automated and manual testing are mandatory for delivery. Automated coverage MUST include
unit, integration, end-to-end, UI, performance, and security testing, with mandatory
automated coverage for authentication, consultation workflow, consultation result generation,
service request creation, manager dashboard request processing, and role-based access
control. No release candidate is acceptable without evidence that critical flows pass.

## Product and Interface Constraints

- The consultation interface MUST include a dialog chat with a progress indicator showing
  consultation completeness percentage and recommendations that guide users toward clearer
  problem descriptions.
- The website MUST include: home, gallery, our works, location with map integration, service
  description, and AI consultation pages.
- Dashboards MUST expose role-specific data and actions:
  - Client: consultation history, saved reports, and service booking.
  - Manager: incoming requests, consultation summaries, full dialogue history, status updates,
    and client contact flow.
  - Administrator: user management, role changes, access restoration/blocking, scenario
    editing, knowledge base management, and analytics.
- Telegram notifications for managers MUST trigger on new service request creation and include
  client name, phone number, vehicle info, problem description, and consultation summary.
- UI/UX must remain responsive and brand-consistent across desktop and mobile; white is the
  primary background, orange and black are accents, and visual design MUST avoid similarity
  with adult website styling.

## Delivery and Operational Rules

- Architecture conformance MUST be validated during planning (`/speckit.plan`) and before
  implementation tasks are approved.
- Every specification MUST include measurable acceptance scenarios for role behavior, AI
  diagnostic output structure, and request lifecycle integrity.
- Task plans MUST explicitly include test tasks for all mandated test levels and manual test
  checkpoints for consultation usability, mobile behavior, manager workflow, and
  administrator workflow.
- Any deviation from required stack, security baseline, or mandatory coverage MUST be tracked
  as a constitution exception with justification and approval before implementation begins.

## Governance

This constitution is the highest-priority project governance artifact and overrides
conflicting local practices in planning, specification, and tasking templates.

Amendment process:
- Propose amendment with explicit rationale and affected principles/sections.
- Classify version bump using semantic versioning:
  - MAJOR: incompatible governance changes or principle removals/redefinitions.
  - MINOR: new principle/section or materially expanded requirements.
  - PATCH: wording clarifications and non-semantic refinements.
- Record a Sync Impact Report in the constitution update and propagate changes to all relevant
  templates before adoption.

Compliance review expectations:
- Every plan MUST complete a constitution check before research/design and re-check after
  design.
- Every task list MUST map implementation and testing tasks to constitutional obligations.
- Reviews MUST reject changes lacking required security controls, role constraints, or
  mandatory critical-flow automated tests.

**Version**: 1.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
