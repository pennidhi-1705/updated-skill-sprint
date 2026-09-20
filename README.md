# updated-skill-sprint
# SkillSprint 🚀

### Small Tasks. Real Experience. Local Impact.

SkillSprint is a skill-based opportunity and micro-internship platform that connects students with organizations through practical, real-world tasks. It helps students gain hands-on experience, develop relevant skills, and build their professional portfolios while enabling organizations to discover talent and assign meaningful work.

The platform features **Harry AI**, a conversational assistant designed to support students with career guidance, skill development, and platform-related questions.

<p align="center">
  <a href="https://skillsprint-web.vercel.app/">
    <strong>🌐 Visit Live Website</strong>
  </a>
  &nbsp; | &nbsp;
  <a href="https://github.com/pennidhi-1705/updated-skill-sprint">
    <strong>💻 GitHub Repository</strong>
  </a>
</p>

---

## 📌 Table of Contents

- [About the Project](#-about-the-project)
- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Objectives](#-objectives)
- [Key Features](#-key-features)
- [Harry AI Assistant](#-harry-ai-assistant)
- [How SkillSprint Works](#-how-skillsprint-works)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Configuration](#-environment-configuration)
- [Database and Backend](#-database-and-backend)
- [Implementation Status](#-implementation-status)
- [Future Enhancements](#-future-enhancements)
- [Team CODE COOKIES](#-team-code-cookies)
- [Project Links](#-project-links)
- [License](#-license)

---

## 🌟 About the Project

SkillSprint bridges the gap between academic learning and practical industry experience.

Students often learn technical and professional skills through coursework but need opportunities to apply those skills in real-world situations. SkillSprint provides a centralized platform where students can discover tasks, connect with organizations, work on projects, and receive feedback.

Organizations can publish opportunities, review applications, select suitable candidates, and evaluate submitted work.

### Our Vision

To make practical experience and skill development more accessible through meaningful, skill-based opportunities.

### Our Mission

- Connect students with organizations offering practical tasks.
- Encourage learning through real-world project experience.
- Help students demonstrate their abilities through completed work.
- Simplify the process of discovering and managing opportunities.
- Support professional networking between students and organizations.

---

## 🎯 Problem Statement

Students often face challenges when trying to gain practical experience and demonstrate their abilities beyond academic qualifications.

Organizations may also find it difficult to identify suitable candidates for small, specific tasks through conventional recruitment processes.

### Key Challenges

- Limited access to practical, real-world work opportunities.
- Difficulty demonstrating skills through completed projects.
- A gap between academic knowledge and practical application.
- Challenges in discovering suitable tasks and organizations.
- Limited opportunities for structured feedback and professional networking.
- Time-consuming processes for identifying candidates for specific tasks.

---

## 💡 Our Solution

SkillSprint provides a centralized platform where students and organizations connect through skill-based tasks and project opportunities.

The platform enables:

- Students to discover opportunities based on their skills and preferences.
- Organizations to publish tasks and review student applications.
- Rule-based matching between student profiles and task requirements.
- Structured application, project submission, and review workflows.
- Organization discovery, following, and messaging features.
- Conversational assistance through Harry AI.
- Organization verification workflows with clearly identified prototype simulations.

---

## 🎯 Objectives

- Create a platform that connects students with practical opportunities.
- Encourage hands-on learning through short, task-based projects.
- Help students identify skill gaps and plan their learning journey.
- Enable organizations to discover and evaluate potential contributors.
- Support transparent application and project-management workflows.
- Provide a conversational assistant for career and platform guidance.
- Encourage professional networking between students and organizations.

---

## ✨ Key Features

### 🎓 1. Student Portal

The Student Portal helps students discover opportunities and manage their project activities.

- Student registration and login.
- Personalized student dashboard.
- Student profile management.
- Browse available opportunities.
- View task descriptions and required skills.
- Apply for suitable opportunities.
- Track application status.
- View selected projects and project progress.
- Submit completed project work.
- View organization reviews and feedback.
- Discover verified organizations.
- Follow organizations and access messaging features.

### 🏢 2. Organization Portal

The Organization Portal enables organizations to publish opportunities and manage student applications.

- Organization registration and login.
- Organization profile management.
- Organization verification workflow.
- Create and manage tasks.
- Specify required skills, duration, deadlines, work mode, rewards, and deliverables.
- View applications for organization-owned tasks.
- Shortlist, select, or reject applicants.
- Manage projects associated with selected applicants.
- Review student submissions.
- Provide feedback and update project completion status.

### 🧠 3. Skill-Based Matching

SkillSprint includes a deterministic, rule-based matching system that evaluates student profiles against opportunity requirements.

- Compares student skills with required task skills.
- Considers availability and location or remote-work conditions.
- Includes an experience-related scoring component.
- Produces structured matching results.
- Avoids generating random match percentages.

The matching system is designed to make opportunity matching understandable and consistent.

### 📈 4. AI Skill Gap Analysis

The Skill Gap Analysis feature helps students understand areas they may need to develop for their chosen career direction.

- Evaluates skills using student profile information.
- Considers completed projects and experience-related inputs.
- Organizes skills into categories such as Programming, Web Development, Data/AI, Communication, and Problem Solving.
- Identifies development priorities.
- Recommends relevant skills and learning directions.
- Supports career-roadmap and profile-improvement workflows.

The current skill-gap calculations are rule-based and should be interpreted as guidance rather than a formal assessment of professional competence.

### 🛡️ 5. Organization Verification

SkillSprint includes an organization verification workflow intended to support trust within the opportunity marketplace.

- AI-assisted document-consistency checking simulation.
- Mock government-record matching workflow.
- Verification status and confidence information.
- Needs Attention and Rejected review paths.
- Internal review console for authorized admin accounts.
- Audit logging for verification and review actions.

**Prototype limitation:** The current verification services are simulations. They do not establish the authenticity of submitted documents or connect to a live government registry.

### 🌐 6. Organization Discovery and Networking

- Discover organizations through the organization directory.
- View public organization profiles.
- Follow and unfollow organizations.
- Access permission-based student-organization conversations.
- View in-app notifications for supported activities.
- Receive notifications for supported application, messaging, and networking events.

### 💬 7. Messaging and Notifications

- Student-organization conversations.
- Conversation access based on organization messaging permissions.
- Message history within the prototype.
- In-app notifications.
- Read and unread notification states.
- Notifications for supported application and project events.

Messaging and notifications currently use prototype storage rather than a real-time messaging infrastructure.

---

## 🤖 Harry AI Assistant

Harry is the conversational assistant integrated into SkillSprint.

Harry is designed to make the platform easier to understand and navigate by providing conversational assistance, career guidance, technical explanations, and skill-development suggestions.

### Harry's Features

- Floating interactive character interface.
- Expandable chat panel.
- Text-based conversation.
- Platform-related assistance.
- General technical and career questions.
- Skill-gap and learning guidance.
- Context-aware follow-up conversations.
- Browser-based speech recognition where supported.
- Spoken responses through browser speech synthesis where supported.
- Character movement and interaction states.

### How Harry Works

Harry uses a layered approach:

**Layer 1 — Deterministic application logic**

- Handles supported platform-specific operations.
- Uses the application's actual opportunity data.
- Computes matching results through the matching engine.
- Provides deterministic fallback responses.
- Keeps opportunity-related actions connected to application data.

**Layer 2 — Optional AI reasoning**

- Provides natural-language responses for open-ended questions.
- Uses relevant student profile information to personalize responses.
- Receives current opportunity information and grounding facts from the application layer.
- Supports general technical, career, and skill-development conversations.

The optional AI provider is accessed through the backend. The API key is not intended to be exposed in frontend code.

**Important:** AI-backed responses depend on a compatible provider being configured. When the provider is unavailable, Harry can fall back to deterministic responses. Browser speech functionality depends on browser support and permissions.

---

## 🔄 How SkillSprint Works

### Student Workflow

1. Register or log in as a student.
2. Complete the relevant profile information.
3. Browse available opportunities.
4. Review task descriptions and required skills.
5. Apply for a suitable opportunity.
6. Track the application status.
7. If selected, access the associated project.
8. Submit the completed work.
9. Receive feedback and view the project status.

### Organization Workflow

1. Register or log in as an organization.
2. Complete the organization profile and verification workflow.
3. Publish a task with its requirements and deliverables.
4. Review applications received for the task.
5. Shortlist, select, or reject applicants.
6. Manage projects associated with selected applicants.
7. Review submitted work.
8. Provide feedback and update the project's status.

### Shared Project Workflow

SkillSprint maintains relationships between tasks, applications, projects, submissions, and reviews.

- Organization-created tasks retain their organization relationship.
- Eligible tasks appear in the student opportunity marketplace.
- Applications retain the relevant student, task, and organization relationships.
- Selecting an application creates or reuses its associated project.
- Student submissions are linked to the relevant project.
- Organization reviews update the associated project and submission workflow.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| Vite | Frontend development server and build tool |
| JavaScript (ES Modules) | Application logic |
| React Router | Client-side routing |
| CSS | Styling and responsive interface |
| Node.js | Backend runtime |
| Express.js | Backend API |
| PostgreSQL | Relational database schema |
| node-postgres (pg) | PostgreSQL connectivity |
| dotenv | Environment configuration |
| Browser Speech APIs | Speech recognition and speech synthesis where supported |
| localStorage | Prototype data persistence |
| Vercel | Frontend deployment platform |

---

## 📁 Project Structure

```text
skill-sprint/
├── backend/
│   ├── db.js
│   └── server.js
├── database/
│   └── schema.sql
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   └── vengeance/
│   │       ├── HighlightGrid.jsx
│   │       ├── SocialFlipButton.jsx
│   │       ├── StackedCategories.jsx
│   │       ├── InteractiveParticles.jsx
│   │       ├── FlipText.jsx
│   │       ├── PopButton.jsx
│   │       ├── MorphText.jsx
│   │       ├── ScrollProgressPath.jsx
│   │       └── MegaNav.jsx
│   ├── styles/
│   │   └── vengeance.css
│   ├── harry/
│   │   ├── assets/
│   │   │   ├── harry-face.png
│   │   │   └── harry-full.png
│   │   ├── HarryWidget.jsx
│   │   ├── harryAIProvider.js
│   │   ├── harryMovementController.js
│   │   └── useHarrySpeech.js
│   └── services/
│       ├── harryService.js
│       ├── chatService.js
│       ├── aiVerificationService.js
│       ├── aiSkillGapService.js
│       ├── aiMatchingService.js
│       ├── notificationService.js
│       ├── projectService.js
│       ├── organizationService.js
│       ├── storage.js
│       ├── authService.js
│       ├── applicationService.js
│       ├── followService.js
│       ├── matchingService.js
│       ├── conversationService.js
│       ├── governmentVerificationService.js
│       └── taskService.js
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── IMPLEMENTATION_NOTES.md
└── vite.config.js
```

---

## 🚀 Getting Started

Follow these steps to run SkillSprint locally.

### Prerequisites

Install the following:

- Node.js compatible with the project's Vite version.
- npm, included with Node.js.
- Git, if you want to clone the repository.

### Step 1: Clone the Repository

```bash
git clone https://github.com/pennidhi-1705/skill-sprint.git
```

### Step 2: Navigate to the Project Directory

```bash
cd skill-sprint
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start the Frontend

```bash
npm run dev
```

Open the local URL displayed in your terminal by Vite.

### Step 5: Build the Frontend

```bash
npm run build
```

### Step 6: Preview the Production Build

```bash
npm run preview
```

### Step 7: Start the Backend

After configuring the required environment variables, run:

```bash
npm run server
```

The backend uses the Express server in `backend/server.js`.

---

## ⚙️ Environment Configuration

The project includes an `.env.example` file.

Create a local `.env` file in the project root if you need to configure the optional backend integrations.

Example:

```env
DATABASE_URL=
AI_API_KEY=
PORT=3001
```

### Environment Variables

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| AI_API_KEY | Optional AI provider API key |
| ANTHROPIC_API_KEY | Alternative supported AI provider key |
| PORT | Backend server port; defaults to 3001 |

**Security:** Never commit actual API keys, passwords, or database credentials to GitHub. Keep secrets in your local environment or a secure deployment environment.

---

## 🗄️ Database and Backend

SkillSprint includes a PostgreSQL schema and an Express backend.

### Database

The database schema is located at:

```text
database/schema.sql
```

It defines relational structures for platform entities and their relationships, including organizations, tasks, applications, projects, submissions, and reviews.

### Backend API

The backend server is located at:

```text
backend/server.js
```

Available routes include:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Checks API health and configured database connectivity |
| `/api/matching` | POST | Returns a rule-based matching result |
| `/api/harry/chat` | POST | Provides an optional AI-backed conversational response |

The frontend prototype can run independently of the optional backend configuration.

**Current architecture:** Much of the frontend application behavior uses localStorage-backed services. The database schema and backend scaffold do not mean that every frontend feature is already connected to persistent database storage.

---

## 📊 Implementation Status

SkillSprint is a functional prototype with implemented frontend workflows and several simulated or scaffolded integrations.

| Component | Implementation status |
|---|---|
| Student Portal | Frontend prototype implemented |
| Organization Portal | Frontend prototype implemented |
| Opportunity marketplace | Implemented with prototype data services |
| Application workflows | Implemented in the prototype |
| Project and submission workflows | Implemented in the prototype |
| Skill-based matching | Deterministic, rule-based scoring |
| Skill-gap analysis | Rule-based calculations and recommendations |
| Harry AI | Deterministic assistant with optional backend AI integration |
| Speech interaction | Browser-dependent speech APIs |
| Organization verification | Simulated verification pipeline |
| Government-record matching | Mock provider; no live registry connection |
| Data persistence | Primarily localStorage in the prototype |
| PostgreSQL | Schema and backend connectivity scaffold |
| Messaging | Prototype conversations; no real-time WebSocket transport |
| Production authentication | Requires secure server-side implementation |

### Production Readiness

The project should not be considered production-ready until the following areas have been implemented and tested:

- Secure server-side authentication and authorization.
- Persistent database integration across frontend services.
- Secure file and document storage.
- Real organization verification integrations.
- Production-ready messaging infrastructure.
- Comprehensive automated testing and security review.
- Deployment monitoring and operational safeguards.

---

## 🔮 Future Enhancements

Potential future improvements include:

- Integrating secure server-side authentication and authorization.
- Connecting frontend services to persistent PostgreSQL storage.
- Implementing secure document and file storage.
- Improving Harry AI through a production-ready AI provider.
- Integrating suitable real organization verification providers.
- Introducing real-time messaging using WebSockets or a similar technology.
- Expanding skill matching using validated student and task data.
- Improving accessibility and mobile responsiveness.
- Adding automated testing and deployment monitoring.
- Expanding student and organization analytics.
- Introducing additional learning-roadmap and career-development features.

These are proposed enhancements, not claims that the features are already implemented.

---

## 👥 Team CODE COOKIES

**Project:** SkillSprint

**Team Name:** CODE COOKIES

### Team Members

1. PRANAYASRI AKULA
2. CH SBS HARINI
3. VV KRUTHI
4. PENNIDHI SAMMAKKAGARI

---

## 🔗 Project Links

- **Live Website:** https://skillsprint-web.vercel.app/
- **GitHub Repository:** https://github.com/pennidhi-1705/updated-skill-sprint

---

## 📄 License

No license has currently been specified for this repository.

---

<p align="center">
  <strong>SkillSprint 🚀</strong>
  <br>
  Small Tasks. Real Experience. Local Impact.
  <br><br>
  Built with ❤️ by CODE COOKIES
</p>
