# Feature Specification: AI Consultation Platform for Car Service

**Feature Branch**: `001-ai-consultation-platform`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Create a full product specification for a graduation project called AI assistant for automating the primary consultation process of car service clients"

## Clarifications

### Session 2026-03-24

- Q: Which canonical service request statuses should managers use? → A: Five states — New, In progress, Scheduled, Completed, Cancelled (Option B).
- Q: When may the client finish the consultation and create a service request? → A: All six mandatory extracted fields must be present and stored — make, model, year, mileage, symptoms, problem conditions (Option A).
- Q: Quantitative performance and scale targets? → A: p95 visible assistant reply ≤ 5 s; ≥ 50 simultaneous active consultations; ≥ 99% monthly availability excluding planned maintenance (Option A).
- Q: How should managers contact clients after a service request exists? → A: Both — show phone (and profile email when present) plus an in-app message thread scoped to each service request (Option C).
- Q: If the local AI module is unavailable during consultation? → A: Block new assistant turns; clear error; preserve session and messages; user retries when healthy (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guided Client Consultation and Request Creation (Priority: P1)

A client registers, logs in, opens the AI consultation page, describes a vehicle problem in
free form, answers dynamic follow-up questions, receives a structured preliminary diagnostic
result, and creates a service request from that result.

**Why this priority**: This is the core business workflow that directly reduces manager
workload and creates structured incoming demand for the service center.

**Independent Test**: Can be fully tested by completing consultation from first message to
saved report and submitted service request with no manager/admin actions required.

**Acceptance Scenarios**:

1. **Given** an authenticated client with an empty consultation history, **When** the client
   completes a dialog consultation and confirms request creation, **Then** the system stores
   session data, generated summary, and a new service request linked to the client profile.
2. **Given** a consultation with incomplete vehicle details, **When** the client submits vague
   symptom text, **Then** the assistant asks contextual clarification questions and updates the
   progress indicator based on newly completed fields.
3. **Given** a completed consultation, **When** final results are shown, **Then** the client
   sees possible failure causes, probability percentages, confidence score, cost range, and a
   statement that results are preliminary and do not replace mechanic diagnostics.
4. **Given** a consultation where any one of the six mandatory extracted fields is missing,
   **When** the client attempts to finish the consultation or create a service request, **Then**
   the system blocks the action and continues the clarification flow until all six are stored.
5. **Given** an active consultation, **When** the local AI module is unavailable or errors on a
   turn, **Then** the system shows a clear error, does not add a false assistant diagnosis, keeps
   prior messages intact, and allows the client to retry after recovery without starting over.

---

### User Story 2 - Manager Intake and Processing Workflow (Priority: P2)

A manager logs in to the manager dashboard, reviews incoming service requests with structured
diagnostic summaries, opens full consultation details, updates request statuses, and contacts
clients for next-step scheduling.

**Why this priority**: Operational adoption depends on manager ability to process requests
quickly with complete context from AI consultations.

**Independent Test**: Can be tested by creating requests as a client and validating manager
list, details, status transitions, and notification reception.

**Acceptance Scenarios**:

1. **Given** at least one newly created request, **When** the manager opens the request list,
   **Then** each item shows client info, vehicle info, short issue summary, and current status.
2. **Given** a selected request, **When** the manager opens details, **Then** the full
   consultation dialogue, extracted diagnostic data, and generated summary are available.
3. **Given** a new request creation event, **When** notification delivery succeeds, **Then**
   the manager receives a Telegram message containing required short request details.
4. **Given** an existing service request, **When** the manager opens request details, **Then**
   the client phone number and optional profile email are shown for telephone or external email
   contact, and **When** either party sends an in-app follow-up message, **Then** it appears in
   the request-scoped thread visible to that client and assigned managers only.

---

### User Story 3 - Administrator Governance and Content Control (Priority: P3)

An administrator manages users and roles, controls access, updates consultation scenarios and
knowledge base materials, maintains service categories, and monitors analytics/system activity.

**Why this priority**: Sustainable production operation requires governance, quality control,
and maintainability of consultation logic and access policies.

**Independent Test**: Can be tested by performing role and content changes in admin dashboard
and verifying downstream behavior for clients/managers.

**Acceptance Scenarios**:

1. **Given** existing user accounts, **When** an administrator changes a user's role, **Then**
   permissions change immediately according to the role access matrix.
2. **Given** active consultation scenarios and knowledge entries, **When** an administrator
   updates them, **Then** new consultations use the latest active versions.
3. **Given** system activity over time, **When** an administrator opens analytics, **Then**
   role-based usage and request-processing metrics are visible.

---

### User Story 4 - Public Website Navigation and Responsive Experience (Priority: P3)

Visitors and authenticated users can navigate required pages and use the platform on desktop
and mobile with consistent brand styling and usable controls.

**Why this priority**: The consultation product must be discoverable and usable across devices
to support real client traffic.

**Independent Test**: Can be tested by navigating all required pages and role dashboards on
desktop and mobile viewport profiles.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** the visitor navigates the site, **Then** Home,
   About, Gallery, Our Works, Location/Map, AI consultation, and authentication pages are
   available and render correctly.
2. **Given** a mobile client session, **When** the user opens consultation chat and dashboards,
   **Then** navigation, chat controls, and forms remain touch-friendly and readable.
3. **Given** any page in the system, **When** UI theme renders, **Then** white is the primary
   background, orange/black are accents, and styling remains professional automotive service
   oriented.

### Edge Cases

- Client attempts to submit a request before all six mandatory extracted fields are complete.
- Client disconnects mid-consultation and later resumes from another device.
- Extracted vehicle parameters conflict with free-text user statements.
- Telegram API is unavailable when a request is created.
- Client or manager attempts to post a new in-app follow-up message when the service request
  status is Completed or Cancelled.
- Manager updates the same request status concurrently from two sessions.
- Manager or API attempts to set a service request status outside the canonical five values.
- Administrator blocks a user while an active session is in progress.
- Extremely long or malformed user chat input triggers validation and safe handling.
- Consultation result returns low confidence and must still provide actionable next steps.
- Local AI module is unavailable or fails while the client is mid-consultation.

## Requirements *(mandatory)*

### Functional Requirements

#### System Overview and Goals

- **FR-001**: System MUST provide a production-ready web platform that automates initial
  consultation between clients and a car service center using an AI dialog assistant.
- **FR-002**: System MUST improve intake quality by converting free-form client descriptions
  into structured diagnostic summaries suitable for manager processing.
- **FR-003**: System MUST support a complete consultation-to-request lifecycle without requiring
  manager involvement during the client consultation phase.

#### Roles and Access

- **FR-004**: System MUST support exactly three roles: Client, Manager, Administrator.
- **FR-005**: System MUST enforce role-based access so users only access role-appropriate pages,
  data, and actions.
- **FR-006**: System MUST prevent unauthorized access attempts and return clear access denial
  responses for restricted resources.

#### Client Capabilities

- **FR-007**: Clients MUST be able to register, authenticate, and manage their own profile.
- **FR-008**: Clients MUST be able to start and complete AI consultations through a dialog
  interface.
- **FR-009**: Clients MUST see a consultation progress bar reflecting consultation completeness.
- **FR-010**: System MUST provide contextual recommendations that help clients describe issues
  with higher clarity.
- **FR-011**: Clients MUST receive final structured consultation results including probable
  failure causes, probability percentages, confidence score, and estimated service cost range.
- **FR-012**: Clients MUST be able to save consultation reports, create service appointment
  requests, view consultation/request history in their dashboard, and read and send in-app
  follow-up messages on their own service requests as defined in FR-016a.

#### Manager Capabilities

- **FR-013**: Managers MUST be able to view incoming requests in a prioritized list with search
  and filtering options.
- **FR-014**: Managers MUST be able to open request details containing client data (including
  phone number and email when stored on the client profile), vehicle details, issue description,
  structured summary, full AI consultation chat history, and the in-app follow-up thread for
  that request.
- **FR-015**: Managers MUST be able to update each service request status using only the
  canonical values: New, In progress, Scheduled, Completed, Cancelled, and use the dashboard as
  an operational processing tool.
- **FR-016**: System MUST send manager Telegram notifications when new requests are created.
- **FR-016a**: For each service request, the system MUST provide an in-app message thread scoped
  exclusively to that request, in which the owning client and managers MAY exchange follow-up
  messages; unauthorized users MUST NOT view or post in that thread.
- **FR-016b**: Request detail views MUST present the client phone number prominently for
  out-of-band telephone contact and MUST show the client email address when present on the
  profile.
- **FR-016c**: When a service request status is Completed or Cancelled, the system MUST reject
  new in-app follow-up posts while preserving the existing thread as read-only for authorized
  client and manager users.

#### Administrator Capabilities

- **FR-017**: Administrators MUST be able to manage users, edit roles, and block/restore
  account access.
- **FR-018**: Administrators MUST be able to manage consultation scenarios, reference materials,
  diagnostic knowledge entries, and service categories.
- **FR-019**: Administrators MUST be able to access analytics and system activity reports.

#### AI Consultation Workflow

- **FR-020**: Consultation flow MUST include welcome, free-form issue input, parameter
  extraction, clarification loop, completion detection, final summary, and save/request/booking
  actions.
- **FR-021**: Assistant MUST extract and store at least: car make, car model, year, mileage,
  symptoms, and problem conditions.
- **FR-022**: Assistant MUST identify missing or ambiguous details and dynamically ask
  clarification questions adapted to prior answers.
- **FR-023**: Assistant MUST classify consultation by service type and generate a preliminary
  diagnostic summary.
- **FR-024**: Assistant MUST present possible failure causes with probability percentages,
  confidence score, and cost range in "from" format.
- **FR-025**: Assistant MUST clearly state that consultation results are preliminary and do not
  replace mechanic diagnostics.
- **FR-025a**: System MUST NOT treat a consultation as complete, MUST NOT present final
  submission actions for service request creation from that consultation, and MUST NOT create a
  service request until all six extracted fields (car make, car model, year, mileage, symptoms,
  problem conditions) are present, non-empty, and persisted. The progress indicator MUST reflect
  completeness against this same six-field gate.
- **FR-025b**: When the local AI module is unavailable or returns a processing error for a
  consultation turn, the system MUST NOT invent assistant diagnostic content; MUST display a
  clear, user-readable error; MUST preserve the consultation session and all stored messages;
  MUST block further AI-driven turns until a retry succeeds or the module is healthy again; and
  MUST NOT mark the consultation complete nor enable service request creation that depends on AI
  output until a successful AI processing cycle has occurred for the current consultation state.

#### Service Request Lifecycle

- **FR-026**: System MUST generate a structured service request only after consultation
  completion as defined in FR-025a.
- **FR-027**: Each request MUST include client full name, phone number, vehicle info, issue
  description, extracted diagnostics, likely causes with probabilities, cost range, consultation
  summary, and a reference to full dialogue history.
- **FR-028**: System MUST store requests and make them available in manager dashboard views.
- **FR-028a**: Newly created service requests MUST start with status New. Every request MUST
  carry exactly one status at a time from the canonical set: New, In progress, Scheduled,
  Completed, Cancelled.

#### Telegram Notifications

- **FR-029**: For every newly created request, system MUST send a Telegram notification that
  contains client name, phone, vehicle info, short issue description, and short consultation
  summary.
- **FR-030**: If notification delivery fails, system MUST preserve request data and mark
  notification status for retry/monitoring.

#### Website and Dashboard Structure

- **FR-031**: Website MUST provide Home, About, Gallery, Our Works, Location/Map, AI
  consultation, authentication, and role-based dashboard pages.
- **FR-032**: Client dashboard MUST include profile, consultation history, saved reports,
  booking options, request history, and access to in-app follow-up threads for each of the
  client's service requests.
- **FR-033**: Manager dashboard MUST include request list, detail view, summary view, full
  AI consultation dialogue view, in-app follow-up thread per request, status management,
  filters, and search.
- **FR-034**: Administrator dashboard MUST include user and role management, consultation
  scenario management, knowledge base management, and analytics.

#### UI/UX Requirements

- **FR-035**: Interface MUST support desktop and mobile responsive layouts with usable
  navigation and touch-friendly controls.
- **FR-036**: UI theme MUST use white as dominant background with orange and black accents and
  maintain a professional automotive service style.
- **FR-037**: Chat UI MUST include rounded message bubbles and an orange progress bar.
- **FR-038**: System MUST avoid visual similarity with adult website styling and avoid orange as
  dominant background color.

#### Non-Functional and Governance Requirements

- **FR-039**: System MUST enforce authenticated access, authorization, input validation, and
  protection against common web vulnerabilities.
- **FR-040**: System MUST provide structured logging and auditable history of critical actions
  (auth events, role changes, request status changes, notification attempts, in-app follow-up
  messages on service requests).
- **FR-041**: System MUST ensure stored consultation history remains available for authorized
  users and role-appropriate operational use.
- **FR-042**: System MUST define performance, reliability, scalability, and usability baselines
  and verify them through dedicated testing.
- **FR-042a**: Under normal operating conditions, p95 elapsed time from the client sending a chat
  message to the assistant reply becoming visible in the consultation UI MUST NOT exceed 5
  seconds.
- **FR-042b**: The system MUST sustain at least 50 simultaneous active consultations without
  functional failure or consultation data loss.
- **FR-042c**: Service availability MUST meet or exceed 99% measured as average uptime over each
  calendar month, excluding announced planned maintenance windows.

#### Integrations

- **FR-043**: System MUST integrate with a locally hosted AI model for consultation processing.
- **FR-044**: System MUST integrate with Telegram Bot messaging for manager notifications.

### Constitution Alignment *(mandatory)*

- **CA-001 Architecture**: Feature preserves required architecture with a web client, modular
  service backend, API contract boundary, persistent consultation/request records, and local AI
  processing module.
- **CA-002 Roles and Access**: Feature defines explicit role permissions and denial cases for
  client, manager, and administrator actions across all dashboards and APIs.
- **CA-003 Security Baseline**: Feature enforces authenticated sessions, access control, strict
  input checks, and baseline protections for user-provided content and query inputs.
- **CA-004 Test Coverage**: Feature includes unit, integration, end-to-end, UI, performance,
  security, and manual acceptance coverage with mandatory automation for critical flows.

### Key Entities *(include if feature involves data)*

- **User**: Person account with identity details, contact data, credentials, status, and role
  binding.
- **Role**: Permission profile defining allowed actions and restricted resources.
- **ConsultationSession**: Full lifecycle record of one client consultation including progress,
  completion state, and generated outputs.
- **Message**: Single chat entry in a consultation timeline with sender, content, and timestamp.
- **ExtractedDiagnosticData**: Structured vehicle/problem facts captured during consultation;
  for a completable consultation and any derived service request, all of car make, car model,
  year, mileage, symptoms, and problem conditions MUST be populated.
- **ConsultationScenario**: Managed flow definition for consultation stages and branching logic.
- **ConsultationQuestion**: Clarification question template and rule metadata.
- **ReferenceMaterial**: Domain knowledge content used to support AI guidance.
- **ServiceCategory**: Service taxonomy used to classify requests.
- **DiagnosticRecommendation**: Generated advisory item with likely causes and reasoning summary.
- **Hint**: Contextual recommendation shown to clients for better issue descriptions.
- **ServiceRequest**: Operational request created from consultation output for manager processing;
  includes a single status field with allowed values New, In progress, Scheduled, Completed,
  Cancelled (initial value New).
- **Notification**: Outbound event record for manager alerts including delivery status history.
- **RequestFollowUpMessage**: In-app message tied to exactly one service request; sender is the
  client or a manager authorized for that request; content and timestamp are retained for audit
  and dashboard display (distinct from AI consultation **Message** entities).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 85% of authenticated clients complete a consultation and reach final
  structured summary without human intervention.
- **SC-002**: At least 90% of completed consultations contain all mandatory extracted diagnostic
  fields before request creation.
- **SC-003**: At least 95% of new service requests appear in manager dashboard within 5 seconds
  after client submission.
- **SC-004**: At least 95% of successful request creations trigger manager notification delivery
  within 30 seconds, with failed deliveries visible for follow-up.
- **SC-005**: At least 90% of critical user journeys (registration/login, consultation,
  request creation, manager processing) complete successfully on mobile and desktop acceptance
  tests.
- **SC-006**: Managers report at least 30% reduction in manual clarification effort during
  request intake over baseline process.

## Assumptions

- The platform serves one car service business domain in the initial release, with multiple
  manager and administrator accounts supported.
- Users have stable internet connectivity during consultation sessions; reconnect and resume is
  supported for short interruptions.
- Diagnostic outputs are advisory only and are always presented as preliminary conclusions.
- Phone number is the primary manager contact field for service request follow-up.
- Consultation and request history retention follows standard operational needs of service
  centers and is available to authorized users.
- Initial release supports one primary notification channel (Telegram) for manager alerts.
- AI model responses are moderated by system validation rules before final structured output is
  persisted.

## Testing Requirements

- **TR-001 Unit Tests**: Cover business logic, extraction validation, progress calculation,
  confidence scoring, service request assembly, and role permission checks.
- **TR-002 Integration Tests**: Cover authentication/authorization, consultation persistence,
  request lifecycle, dashboard data retrieval, notification trigger paths, and AI unavailability
  or error handling during an active consultation (per FR-025b).
- **TR-003 End-to-End Tests**: Cover registration/login, consultation dialog flow, final result
  generation, report saving, service request creation, manager processing, and client–manager
  in-app follow-up messaging on a service request.
- **TR-004 UI Tests**: Cover responsive navigation, chat rendering, progress visibility, form
  validation, dashboard widgets, filters, and search behavior.
- **TR-005 Performance Tests**: Verify stable operation under concurrent consultations and
  request submissions; MUST validate FR-042a (p95 chat reply latency), FR-042b (50 concurrent
  active consultations), and document methodology for FR-042c availability sampling.
- **TR-006 Security Tests**: Verify role access boundaries, unauthorized request blocking, safe
  input handling, and resistance to common injection/script abuse patterns.
- **TR-007 Manual Acceptance**: Validate usability of consultation UX, role workflows,
  administrator content management flow, and mobile interaction quality.
- **TR-008 Mandatory Critical Coverage**: Automated tests MUST cover registration/login,
  role-based access, AI consultation workflow, consultation result generation, service request
  generation, Telegram notification trigger, manager request processing, and responsive UI
  behavior.

## Acceptance Criteria

- **AC-001**: A client can complete end-to-end consultation and create a service request with
  all required structured fields saved.
- **AC-002**: A manager can receive and process created requests using summaries, full AI
  consultation chat context, visible client phone (and email when present), and in-app
  follow-up messaging without data loss.
- **AC-003**: An administrator can manage users/roles and consultation content with auditable
  changes.
- **AC-004**: Required pages and role dashboards are available and usable on desktop and mobile
  layouts.
- **AC-005**: Security and role access restrictions are enforced across all exposed operations.
- **AC-006**: Mandatory automated test coverage for critical flows is present and passing.
