import type { UserRole } from '@/types'

export const PERMISSIONS = {
  createProject:    ['ADMIN', 'QA_LEAD'],
  editProject:      ['ADMIN', 'QA_LEAD'],
  deleteProject:    ['ADMIN'],
  
  createHierarchy:  ['ADMIN', 'QA_LEAD', 'QA_ENGINEER'], // epics, features, stories
  editHierarchy:    ['ADMIN', 'QA_LEAD', 'QA_ENGINEER'],
  deleteHierarchy:  ['ADMIN', 'QA_LEAD'],
  
  createTestCase:   ['ADMIN', 'QA_LEAD', 'QA_ENGINEER'],
  editTestCase:     ['ADMIN', 'QA_LEAD', 'QA_ENGINEER'], // engineers can only edit their own (enforced in UI)
  deleteTestCase:   ['ADMIN', 'QA_LEAD'],
  
  assignReview:     ['QA_ENGINEER', 'QA_LEAD', 'ADMIN'],
  approveReview:    ['ADMIN', 'QA_LEAD'],
  
  createCycle:      ['ADMIN', 'QA_LEAD'],
  editCycle:        ['ADMIN', 'QA_LEAD'],
  deleteCycle:      ['ADMIN'],
  
  updateExecution:  ['ADMIN', 'QA_LEAD', 'QA_ENGINEER'], // engineers can only update assigned ones
  
  viewReports:      ['ADMIN', 'QA_LEAD', 'QA_ENGINEER', 'MANAGER'],
  viewRTM:          ['ADMIN', 'QA_LEAD', 'QA_ENGINEER', 'MANAGER'],
  
  manageUsers:      ['ADMIN'],
} as const

export type PermissionAction = keyof typeof PERMISSIONS

export function can(role: UserRole | string | undefined, action: PermissionAction): boolean {
  if (!role) return false
  const allowedRoles = PERMISSIONS[action] as readonly string[]
  return allowedRoles.includes(role)
}
