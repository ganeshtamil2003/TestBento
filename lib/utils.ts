import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PASS: 'Pass',
  FAIL: 'Fail',
  BLOCKED: 'Blocked',
  NOT_RUN: 'Not Run',
  PENDING: 'Pending',
  AUTOMATED: 'Automated',
  MANUAL: 'Manual',
  SEMI_AUTOMATED: 'Semi-Automated',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  CRITICAL: 'Critical',
  SPRINT: 'Sprint',
  RELEASE: 'Release',
  REGRESSION: 'Regression',
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PASS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  BLOCKED: 'bg-orange-100 text-orange-700',
  NOT_RUN: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-yellow-100 text-yellow-700',
  AUTOMATED: 'bg-purple-100 text-purple-700',
  MANUAL: 'bg-gray-100 text-gray-700',
  SEMI_AUTOMATED: 'bg-indigo-100 text-indigo-700',
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
  CRITICAL: 'bg-red-200 text-red-900',
}
