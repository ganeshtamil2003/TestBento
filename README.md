# QA Test Manager

A modern, scalable, role-based internal Test Management Application built to replace traditional Excel-based QA processes.

## 🚀 Features

- **Hierarchical Test Management**: Organize artifacts by Project → Epic → Feature → User Story → Test Cases.
- **Traceability (RTM)**: Real-time Requirement Traceability Matrix to monitor coverage.
- **Test Execution**: Manage execution cycles, track progress (Pass/Fail/Blocked), and log defects.
- **Review Workflow**: Streamlined test case review process with comments and status transitions.
- **Analytics Dashboards**: Visual insights into execution trends, automation coverage, and defect density.
- **Role-Based Access**: Specialized interfaces for Admin, QA Lead, QA Engineer, and Manager roles.
- **Excel Integration**: Bulk import/export support for test cases using `.xlsx` files.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/) (Shadcn/ui style)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) with Persistence
- **Charts**: [Recharts](https://recharts.org/)
- **Backend / Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Utilities**: `date-fns`, `zod`, `react-hook-form`, `xlsx`

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd qa-test-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local` and fill in your Supabase credentials.
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI components.
- `lib/`: Utility functions (Excel parsing, Supabase client, formatting).
- `store/`: Zustand state management.
- `types/`: Global TypeScript interfaces.
- `supabase/`: SQL migrations and RLS policies (Phase 2).

## 🔒 License

Private / Internal Use Only.
