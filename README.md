# Keystone — Task & Team Management System

A full-stack, production-ready **Task & Team Management System** built with **Django REST Framework (DRF)**, **MySQL**, **JWT Authentication**, and a **React + TypeScript (Vite)** frontend implementing the bespoke **Keystone / Paper Ledger** editorial UI design.

---

## 📑 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Database Schema & Relationships](#database-schema--relationships)
- [API Endpoints Reference](#api-endpoints-reference)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Automated Testing](#automated-testing)
- [Security & Authorization](#security--authorization)
- [Project Structure](#project-structure)

---

## 🌟 Overview

Keystone is designed for focused work, structured task tracking, and team collaboration. It provides complete user isolation, team-based workspaces, role-aware permissions, server-side search/filtering/sorting/pagination, live dashboard metrics, and secure JWT authentication.

---

## ✨ Key Features

### 🔐 1. Authentication & Security
- **Dual Identifier Login**: Sign in using either **Email** or **Username** with password.
- **JWT Token Management**: Stateless authorization using `access` (60 min) and `refresh` (7 days) tokens with automatic refresh on 401.
- **User Profile**: `GET /api/auth/me/` provides the authenticated user's profile and metadata.
- **User Directory**: `GET /api/auth/users/` allows discovering registered users for team invites and task assignment.

### 📋 2. Advanced Task Management
- **Full Task CRUD**: Create, read, update (PATCH), and delete tasks.
- **Task Attributes**: Title, detailed notes, Status (`todo`, `in_progress`, `completed`), Priority (`low`, `medium`, `high`, `urgent`), Deadline datetime, Team association, Assignee user.
- **Server-Side Filtering**: Filter tasks by `status`, `priority`, `team`, `assigned_to`, and text `search` (title & description).
- **Server-Side Sorting**: Sort tasks by `created_at`, `updated_at`, `deadline`, `priority`, and `title` (ascending/descending).
- **Pagination**: Paginated results with `count`, `next`, and `previous` links (default page size: 10).
- **Interactive Modals**: Detailed task drawer modal, quick status check/toggle, edit modal with real user and team dropdowns.

### 👥 3. Teams & Collaboration
- **Team Workspaces**: Create teams with name and description.
- **Member Management**: Team owners can add members (via user picker or username/email) and remove members.
- **Ownership Permissions**:
  - `IsTeamOwner`: Only team creators can add/remove members.
  - `IsTeamOwnerOrReadOnly`: Team members can view team details and tasks; only owners can edit or delete teams.
- **Team Task Counters**: Real-time counter of associated tasks per team.
- **One-Click Team Filtering**: Jump directly from a team card/modal into the Task register filtered for that team.

### 📊 4. Live Workspace Analytics
- **Aggregation Metrics**: Real-time counts for total workspace tasks, to-do, in-progress, and completed tasks.
- **Visual Rhythm Ring**: Completion rate percentage ring and daily focus indicators.

---

## 🏗 Architecture & Tech Stack

### Backend
- **Framework**: Django 6.1
- **API Engine**: Django REST Framework (DRF) 3.16+
- **Authentication**: `djangorestframework-simplejwt`
- **Database**: MySQL 8.x (`mysqlclient`)
- **CORS**: `django-cors-headers`
- **Environment**: `python-dotenv`

### Frontend
- **Framework**: React 18 + TypeScript
- **Bundler**: Vite 7
- **Routing**: Wouter
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Design System**: Vanilla CSS Swiss-editorial "Keystone Paper Ledger" theme

---

## 🗄 Database Schema & Relationships

```
+------------------+         +---------------------+         +------------------+
|    users.User    |         |     teams.Team      |         |    tasks.Task    |
+------------------+         +---------------------+         +------------------+
| id (PK)          |<---+    | id (PK)             |<---+    | id (PK)          |
| username         |    |    | name                |    |    | title            |
| email            |    +---*| created_by (FK)     |    |    | description      |
| password         |    |    | created_at          |    |    | status           |
| first_name       |    |    +---------------------+    |    | priority         |
| last_name        |    |               ^               |    | deadline         |
| is_active        |    |               |               +---*| team (FK, null)  |
| date_joined      |    |    +----------+----------+    |    | created_by (FK)  |
+------------------+    |    |  teams_team_members |    +---*| assigned_to (FK) |
         ^              |    +---------------------+         | created_at       |
         |              +---*| user_id (FK)        |         | updated_at       |
         |                   | team_id (FK)        |         +------------------+
         +-------------------*---------------------+
```

---

## 🔌 API Endpoints Reference

### Authentication (`/api/auth/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register/` | Register new user account | No |
| `POST` | `/api/auth/login/` | Obtain JWT token pair (via email or username) | No |
| `POST` | `/api/auth/refresh/` | Refresh JWT access token | No |
| `GET` | `/api/auth/me/` | Retrieve current authenticated user profile | Yes |
| `GET` | `/api/auth/users/` | List active users for assignment/collaboration | Yes |

### Tasks (`/api/tasks/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/tasks/` | List tasks (supports `status`, `priority`, `team`, `assigned_to`, `search`, `ordering`, `page`) | Yes |
| `POST` | `/api/tasks/` | Create a new task | Yes |
| `GET` | `/api/tasks/<id>/` | Retrieve specific task detail | Yes |
| `PATCH`| `/api/tasks/<id>/` | Update task fields (creator only) | Yes |
| `DELETE`| `/api/tasks/<id>/` | Delete task (creator only) | Yes |
| `GET` | `/api/tasks/statistics/`| Aggregated metrics (total, todo, in_progress, completed) | Yes |

### Teams (`/api/teams/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/teams/` | List user's teams (created or member) | Yes |
| `POST` | `/api/teams/` | Create a new team | Yes |
| `GET` | `/api/teams/<id>/` | Retrieve team detail with members and task count | Yes |
| `PATCH`| `/api/teams/<id>/` | Update team details (owner only) | Yes |
| `DELETE`| `/api/teams/<id>/` | Delete team (owner only) | Yes |
| `POST` | `/api/teams/<id>/members/` | Add member (`user_id`, `username`, or `email`) | Yes (Owner) |
| `DELETE`| `/api/teams/<id>/members/<user_id>/` | Remove member from team | Yes (Owner) |

---

## 📦 Prerequisites

Before starting, ensure you have the following installed:
- **Python 3.11+**
- **Node.js 18+** & **pnpm** (`npm install -g pnpm`)
- **MySQL Server 8.x** running locally or accessible via network

---

## 🚀 Installation & Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers mysqlclient python-dotenv

# Configure environment file
cp .env.example .env
# Edit .env with your MySQL credentials (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT)

# Run database migrations
python manage.py makemigrations
python manage.py migrate

# (Optional) Create superuser
python manage.py createsuperuser
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
pnpm install

# Configure environment file
cp .env.example .env
# Ensure VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```env
SECRET_KEY=your-secure-django-secret-key
DEBUG=True
DB_NAME=task_management
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=localhost
DB_PORT=3306
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

---

## 🏃 Running the Application

### Start Backend API Server
```bash
cd backend
venv\Scripts\activate
python manage.py runserver
# API Server runs at http://127.0.0.1:8000/
```

### Start Frontend Client
```bash
cd frontend
pnpm dev
# Web application runs at http://localhost:5173/ (or specified port)
```

---

## 🧪 Automated Testing

The backend includes comprehensive test suites verifying end-to-end functionality, database integrity, and authorization rules.

```bash
cd backend
venv\Scripts\activate

# Run system verification
python manage.py check

# Run full Phase 1-12 production test suite
python test_full_suite.py
```

### Verified Test Cases:
1. User registration (valid/invalid validation, password hashing, ID return).
2. Dual-mode authentication (Email + Password and Username + Password).
3. JWT token issuance and refresh rotation cycle.
4. User profile and directory lookups.
5. Task lifecycle (Create, Read, Update status/priority/team/assignee, Delete).
6. Server-side search, filtering, ordering, and pagination.
7. Workspace task statistics aggregation.
8. Team creation and member addition/removal with database verification.
9. Security enforcement (403 Forbidden on non-owner team deletion/member removal/task deletion).
10. Task-to-team assignment integrity and team task count calculation.

---

## 🔒 Security & Authorization

- **Password Security**: Uses Django's PBKDF2 with SHA256 password hasher.
- **JWT Authorization**: Cryptographically signed access and refresh tokens.
- **Object Permissions**:
  - `IsTaskOwnerOrReadOnly`: Restricts modification/deletion of tasks to the creator.
  - `IsTeamOwnerOrReadOnly`: Restricts team modification/deletion to the creator.
  - `IsTeamOwner`: Restricts team member invitation/removal to team creator.
- **Validation**: Strict server-side validation on task assignee ensuring users assigned to a team task are valid members of that team.
- **Safe Ordering**: Whitelist-based ordering parameter validation preventing SQL injection or exposure of private columns.

---

## 📁 Project Structure

```
Task-Management-System/
├── README.md                      # Comprehensive Project Documentation
├── docker-compose.yml             # Container orchestration config
├── backend/                       # Django REST Framework Backend
│   ├── manage.py                  # Django management utility
│   ├── .env                       # Backend environment configuration
│   ├── .env.example               # Example environment variables
│   ├── test_full_suite.py         # Full Phase 1-12 automated test suite
│   ├── test_teams_e2e.py          # Teams E2E authorization tests
│   ├── config/                    # Core Django project configuration
│   │   ├── settings.py            # Django & DRF settings
│   │   ├── urls.py                # Root URL routing & API root
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── users/                     # Authentication & User Management app
│   │   ├── models.py              # Custom User model
│   │   ├── serializers.py         # User, Register, Custom JWT serializers
│   │   ├── views.py               # Register, Login, CurrentUser, UserList
│   │   └── urls.py
│   ├── tasks/                     # Task Management app
│   │   ├── models.py              # Task model with status/priority choices
│   │   ├── serializers.py         # Task serializer & assignment validator
│   │   ├── permissions.py         # IsTaskOwnerOrReadOnly, IsTaskTeamMember
│   │   ├── views.py               # TaskListCreateView, TaskDetailView
│   │   ├── pagination.py          # TaskPagination
│   │   ├── dashboard.py           # TaskStatisticsView
│   │   └── urls.py
│   └── teams/                     # Teams & Collaboration app
│       ├── models.py              # Team model with members ManyToMany
│       ├── serializers.py         # TeamSerializer with task_count
│       ├── permissions.py         # IsTeamOwner, IsTeamOwnerOrReadOnly
│       ├── views.py               # TeamListCreateView, TeamDetailView, TeamMemberView
│       └── urls.py
└── frontend/                      # React + TypeScript Frontend
    ├── package.json               # Frontend dependencies & scripts
    ├── vite.config.ts             # Vite configuration
    ├── .env.example               # Example frontend environment variables
    └── client/
        └── src/
            ├── App.tsx            # Main application UI, routing & modals
            ├── main.tsx           # React entry point
            ├── index.css          # Keystone / Paper Ledger design system
            └── lib/
                └── api.ts         # Centralized typed API client
```

---

## License

Copyright (c) 2026 Junaid Khan

All Rights Reserved.

This project and its source code are provided for viewing and evaluation
purposes only. No permission is granted to use, copy, modify, merge, publish,
distribute, sublicense, or sell copies of this software without prior written
permission from the copyright holder.

For permission to use or reuse any part of this project, please contact the
copyright holder.

See the [LICENSE](LICENSE) file for the complete license terms.