-- Role Enum
CREATE TYPE global_role AS ENUM ('ADMIN', 'QA_LEAD', 'QA_ENGINEER', 'MANAGER');
CREATE TYPE test_case_status AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE execution_status AS ENUM ('NOT_RUN', 'PASS', 'FAIL', 'BLOCKED');
CREATE TYPE automation_status AS ENUM ('AUTOMATED', 'MANUAL', 'SEMI_AUTOMATED');
CREATE TYPE priority_level AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- Profiles Table (Linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  global_role global_role NOT NULL DEFAULT 'QA_ENGINEER',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Epics Table
CREATE TABLE epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Features Table
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Stories Table
CREATE TABLE user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  assignee_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Cases Table
CREATE TABLE test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  preconditions TEXT,
  postconditions TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_result TEXT,
  automation_status automation_status NOT NULL DEFAULT 'MANUAL',
  status test_case_status NOT NULL DEFAULT 'DRAFT',
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review Cycles
CREATE TABLE review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  status review_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Execution Cycles
CREATE TABLE execution_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sprint_name TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution Items
CREATE TABLE execution_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES execution_cycles(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id),
  status execution_status NOT NULL DEFAULT 'NOT_RUN',
  defects JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) SETUP
------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_items ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Anyone authenticated can read them. Users can edit their own.
CREATE POLICY "Profiles are viewable by all users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Projects: Authenticated users can read. (Creation locked down later in API/Frontend)
CREATE POLICY "Projects are viewable by all users" ON projects
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Projects are creatable by authenticated" ON projects
  FOR ALL USING (auth.role() = 'authenticated'); 

-- 3. Everything else: For now, full CRUD for authenticated users.
-- We will enforce the specific RBAC rules (Admin vs QA Engineer) heavily in the NEXT.JS FRONTEND, 
-- but allow the database inserts to succeed if the user is logged in.

CREATE POLICY "Full access to authenticated users" ON epics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON features FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON user_stories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON test_cases FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON review_cycles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON execution_cycles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Full access to authenticated users" ON execution_items FOR ALL USING (auth.role() = 'authenticated');

-- Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_title TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs are viewable by authenticated users" ON audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Audit logs can be inserted by authenticated users" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Defect Management Table
CREATE TYPE defect_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  execution_item_id UUID REFERENCES execution_items(id) ON DELETE SET NULL,
  test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status defect_status NOT NULL DEFAULT 'OPEN',
  description TEXT,
  jira_url TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Defects are viewable by authenticated users" ON defects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Defects can be inserted/updated by authenticated users" ON defects FOR ALL USING (auth.role() = 'authenticated');

-- Project Members Table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role global_role NOT NULL DEFAULT 'QA_ENGINEER',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members viewable by authenticated users" ON project_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Project members manageable by authenticated users" ON project_members FOR ALL USING (auth.role() = 'authenticated');

-- Notifications Table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications are viewable by authenticated users" ON notifications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Notifications can be inserted/updated by authenticated users" ON notifications FOR ALL USING (auth.role() = 'authenticated');
