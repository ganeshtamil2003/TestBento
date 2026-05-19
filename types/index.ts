export type UserRole = 'QA_ENGINEER' | 'QA_LEAD' | 'MANAGER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER'

export type TestCaseStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ExecutionStatus = 'NOT_RUN' | 'PASS' | 'FAIL' | 'BLOCKED'

export type AutomationStatus = 'AUTOMATED' | 'MANUAL' | 'SEMI_AUTOMATED'

export type CycleType = 'SPRINT' | 'RELEASE' | 'REGRESSION'

export type DefectSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  global_role: UserRole
  created_at: string
  status: 'ACTIVE' | 'SUSPENDED'
}

export interface Project {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  _member_role?: UserRole
  _counts?: {
    epics: number
    test_cases: number
    members: number
  }
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  created_at: string
  profile?: Profile
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  link?: string
  is_read: boolean
  created_at: string
}

export interface Epic {
  id: string
  project_id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
  _counts?: { features: number }
}

export interface Feature {
  id: string
  epic_id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
  _counts?: { user_stories: number }
}

export interface UserStory {
  id: string
  feature_id: string
  title: string
  description?: string
  acceptance_criteria?: string
  assignee_id?: string
  created_at: string
  updated_at: string
  _counts?: { test_cases: number }
  assignee?: Profile
}

export interface TestStep {
  step_number: number
  action: string
  test_data?: string
  expected_result: string
}

export interface TestCase {
  id: string
  story_id: string
  title: string
  description?: string
  preconditions?: string
  postconditions?: string
  steps: TestStep[]
  expected_result?: string
  attachments?: string[]
  parameters?: Record<string, string>
  automation_status: AutomationStatus
  status: TestCaseStatus
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  created_by: string
  created_at: string
  updated_at: string
  // joined
  story?: UserStory
  creator?: Profile
  latest_review?: ReviewCycle
}

export interface ReviewCycle {
  id: string
  test_case_id: string
  reviewer_id: string
  assigned_by: string
  status: ReviewStatus
  created_at: string
  resolved_at?: string
  reviewer?: Profile
  assigner?: Profile
  comments?: ReviewComment[]
}

export interface ReviewComment {
  id: string
  review_cycle_id: string
  author_id: string
  comment: string
  created_at: string
  author?: Profile
}

export interface ExecutionCycle {
  id: string
  project_id: string
  name: string
  type: CycleType
  sprint_name?: string
  start_date?: string
  end_date?: string
  created_by: string
  created_at: string
  _counts?: {
    total: number
    pass: number
    fail: number
    blocked: number
    not_run: number
  }
}

export interface ExecutionItem {
  id: string
  cycle_id: string
  test_case_id: string
  assigned_to?: string
  status: ExecutionStatus
  notes?: string
  executed_at?: string
  executed_by?: string
  created_at: string
  test_case?: TestCase
  assignee?: Profile
  defects?: Defect[]
}

export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export interface Defect {
  id: string
  project_id: string
  execution_item_id?: string
  test_case_id?: string
  title: string
  severity: DefectSeverity
  status: DefectStatus
  description?: string
  jira_url?: string
  assigned_to?: string
  created_by: string
  created_at: string
  updated_at: string
  creator?: Profile
  assignee?: Profile
  test_case?: TestCase
}

export interface GeneratedTestCase {
  title: string
  description?: string
  preconditions?: string
  postconditions?: string
  steps: TestStep[]
  expected_result?: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  automation_status: AutomationStatus
  isSelected: boolean
}

export interface AuditLog {
  id: string
  project_id: string
  user_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string
  entity_type: 'TEST_CASE' | 'EPIC' | 'FEATURE' | 'USER_STORY' | 'EXECUTION_CYCLE' | string
  entity_id: string
  entity_title?: string
  details?: Record<string, any>
  created_at: string
  user?: Profile
}
