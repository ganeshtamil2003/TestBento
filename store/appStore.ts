'use client'

import { create } from 'zustand'
import type { Profile, Project, Epic, Feature, UserStory, TestCase, ReviewCycle, ExecutionCycle, ExecutionItem } from '@/types'

interface AppState {
  currentUser: Profile
  projects: Project[]
  epics: Epic[]
  features: Feature[]
  userStories: UserStory[]
  testCases: TestCase[]
  reviewCycles: ReviewCycle[]
  executionCycles: ExecutionCycle[]
  executionItems: ExecutionItem[]
  profiles: Profile[]

  // Actions
  setCurrentUser: (user: Profile) => void
  addProject: (project: Project) => void
  updateProject: (id: string, data: Partial<Project>) => void
  deleteProject: (id: string) => void
  addEpic: (epic: Epic) => void
  updateEpic: (id: string, data: Partial<Epic>) => void
  deleteEpic: (id: string) => void
  addFeature: (feature: Feature) => void
  updateFeature: (id: string, data: Partial<Feature>) => void
  deleteFeature: (id: string) => void
  addUserStory: (story: UserStory) => void
  updateUserStory: (id: string, data: Partial<UserStory>) => void
  deleteUserStory: (id: string) => void
  addTestCase: (tc: TestCase) => void
  updateTestCase: (id: string, data: Partial<TestCase>) => void
  deleteTestCase: (id: string) => void
  addTestCases: (tcs: TestCase[]) => void
  addReviewCycle: (rc: ReviewCycle) => void
  updateReviewCycle: (id: string, data: Partial<ReviewCycle>) => void
  addExecutionCycle: (cycle: ExecutionCycle) => void
  updateExecutionCycle: (id: string, data: Partial<ExecutionCycle>) => void
  deleteExecutionCycle: (id: string) => void
  addExecutionItem: (item: ExecutionItem) => void
  updateExecutionItem: (id: string, data: Partial<ExecutionItem>) => void
  removeExecutionItem: (id: string) => void

  setInitialData: (data: Partial<AppState>) => void
}

export const useAppStore = create<AppState>()((set) => ({
  currentUser: { id: '', email: '', full_name: 'Loading...', global_role: 'QA_ENGINEER', created_at: '', status: 'ACTIVE' },
  projects: [],
  epics: [],
  features: [],
  userStories: [],
  testCases: [],
  reviewCycles: [],
  executionCycles: [],
  executionItems: [],
  profiles: [],

  setCurrentUser: (user) => set({ currentUser: user }),

  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, data) => set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...data } : p) })),
  deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  addEpic: (epic) => set((s) => ({ epics: [...s.epics, epic] })),
  updateEpic: (id, data) => set((s) => ({ epics: s.epics.map((e) => e.id === id ? { ...e, ...data } : e) })),
  deleteEpic: (id) => set((s) => ({ epics: s.epics.filter((e) => e.id !== id) })),

  addFeature: (feature) => set((s) => ({ features: [...s.features, feature] })),
  updateFeature: (id, data) => set((s) => ({ features: s.features.map((f) => f.id === id ? { ...f, ...data } : f) })),
  deleteFeature: (id) => set((s) => ({ features: s.features.filter((f) => f.id !== id) })),

  addUserStory: (story) => set((s) => ({ userStories: [...s.userStories, story] })),
  updateUserStory: (id, data) => set((s) => ({ userStories: s.userStories.map((st) => st.id === id ? { ...st, ...data } : st) })),
  deleteUserStory: (id) => set((s) => ({ userStories: s.userStories.filter((st) => st.id !== id) })),

  addTestCase: (tc) => set((s) => ({ testCases: [...s.testCases, tc] })),
  updateTestCase: (id, data) => set((s) => ({ testCases: s.testCases.map((tc) => tc.id === id ? { ...tc, ...data } : tc) })),
  deleteTestCase: (id) => set((s) => ({ testCases: s.testCases.filter((tc) => tc.id !== id) })),
  addTestCases: (tcs) => set((s) => ({ testCases: [...s.testCases, ...tcs] })),

  addReviewCycle: (rc) => set((s) => ({ reviewCycles: [...s.reviewCycles, rc] })),
  updateReviewCycle: (id, data) => set((s) => ({ reviewCycles: s.reviewCycles.map((rc) => rc.id === id ? { ...rc, ...data } : rc) })),

  addExecutionCycle: (cycle) => set((s) => ({ executionCycles: [...s.executionCycles, cycle] })),
  updateExecutionCycle: (id, data) => set((s) => ({ executionCycles: s.executionCycles.map((c) => c.id === id ? { ...c, ...data } : c) })),
  deleteExecutionCycle: (id) => set((s) => ({ executionCycles: s.executionCycles.filter((c) => c.id !== id) })),

  addExecutionItem: (item) => set((s) => ({ executionItems: [...s.executionItems, item] })),
  updateExecutionItem: (id, data) => set((s) => ({ executionItems: s.executionItems.map((ei) => ei.id === id ? { ...ei, ...data } : ei) })),
  removeExecutionItem: (id) => set((s) => ({ executionItems: s.executionItems.filter((ei) => ei.id !== id) })),

  setInitialData: (data) => set(data),
}))
