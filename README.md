# TestBento

A modern, scalable, role-based Quality Assurance (QA) Test Management Application. Built to replace traditional Excel-based QA processes with a centralized platform for managing projects, requirements, test cases, executions, and defects.

## 🚀 Key Features

- **Hierarchical Requirements**: Organize your product structure via Projects → Epics → Features → User Stories.
- **AI-Powered Test Case Generation**: Automatically generate comprehensive test cases from user story requirements using Google Gemini AI integration.
- **Traceability (RTM)**: Real-time Requirement Traceability Matrix to ensure 100% test coverage and monitor untested areas.
- **Test Execution**: Manage execution cycles (e.g., Sprints, Releases), track execution status (Pass/Fail/Blocked), and dynamically filter results.
- **Defect Management**: Built-in bug tracking to log defects, assign severity, and link directly to failed execution items.
- **Review Workflow**: Streamlined test case peer-review process (Draft → In Review → Approved/Rejected) with commenting.
- **Analytics Dashboards**: Visual insights into execution trends, automation coverage, and defect density using interactive charts.
- **Role-Based Access Control (RBAC)**: Specialized interfaces and permissions for Admin, QA Lead, QA Engineer, Developer, Manager, and Viewer.
- **Audit Logging**: Comprehensive activity tracking across all project modules for security and accountability.

## 🛠️ Tech Stack

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router), [React 18](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), Lucide Icons
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Charts**: [Recharts](https://recharts.org/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL + Row Level Security)
- **AI Integration**: `@google/generative-ai`

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase Project
- A Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd TestBento
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Database Setup:
   - Run the SQL script located at `supabase/setup.sql` in your Supabase project's SQL Editor to create the necessary tables, enums, and RLS policies.

4. Configure environment variables:
   Copy `.env.example` (or create one) to `.env.local` and add your credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

- `app/`: Next.js App Router pages, layouts, and API routes.
  - `(app)/`: Authenticated application routes (Dashboard, Projects, etc.).
  - `(auth)/`: Authentication routes (Login).
- `components/`: Reusable UI components and Modals.
- `lib/`: Utility functions (Supabase clients, formatting, permissions, AI generation).
- `store/`: Zustand global state management slices (`appStore.ts`).
- `types/`: Global TypeScript interfaces and type definitions.
- `supabase/`: Database schema and initial setup scripts.

## 📝 Documentation
For detailed information on the project lifecycle, workflows, and individual module guides, please refer to the `TestBento_Documentation.pdf` provided in the repository root.

## 🔒 License

Private / Internal Use Only.
