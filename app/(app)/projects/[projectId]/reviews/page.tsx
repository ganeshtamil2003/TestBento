'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { ChevronRight, UserCheck, MessageSquare, Plus, CheckCircle, XCircle, CheckSquare, Square } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, cn, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'
import { createNotification } from '@/lib/notifications'
import type { ReviewCycle, ReviewComment, ReviewStatus } from '@/types'

export default function ReviewsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)

  const epicIds = new Set(store.epics.filter(e => e.project_id === projectId).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const storyIds = new Set(store.userStories.filter(s => featureIds.has(s.feature_id)).map(s => s.id))

  // All project TCs (used for review status pipeline — reviewer can see all)
  const allProjectTCs = store.testCases.filter(tc => storyIds.has(tc.story_id))

  // ✅ FIX 1: Only TCs written by the logged-in user are selectable for submission
  const myTCs = allProjectTCs.filter(tc => tc.created_by === store.currentUser.id)

  // ✅ FIX 2: Multi-select for bulk submission
  const [selectedTCIds, setSelectedTCIds] = useState<string[]>([])
  const [reviewerId, setReviewerId] = useState('')
  const [comment, setComment] = useState('')
  const [activeReview, setActiveReview] = useState<ReviewCycle | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currentUser = store.currentUser
  const supabase = createClient()

  const reviews = store.reviewCycles.filter(rc => allProjectTCs.some(tc => tc.id === rc.test_case_id))
  const leads = store.profiles.filter(p => ['QA_LEAD', 'MANAGER'].includes(p.global_role))

  // TCs that are still in Draft / not yet submitted (no pending review)
  const submittableTCs = myTCs.filter(tc =>
    tc.status === 'DRAFT' && !reviews.some(rc => rc.test_case_id === tc.id && rc.status === 'PENDING')
  )

  const allSelected = submittableTCs.length > 0 && selectedTCIds.length === submittableTCs.length
  function toggleAll() {
    setSelectedTCIds(allSelected ? [] : submittableTCs.map(tc => tc.id))
  }
  function toggleTC(id: string) {
    setSelectedTCIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function assignReview() {
    if (selectedTCIds.length === 0 || !reviewerId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload = selectedTCIds.map(tcId => ({
        test_case_id: tcId,
        reviewer_id: reviewerId,
        assigned_by: currentUser.id,
        status: 'PENDING',
      }))
      const { data, error } = await supabase.from('review_cycles').insert(payload).select()
      
      if (!error && data) {
        data.forEach(rc => store.addReviewCycle(rc as ReviewCycle))
        await supabase.from('test_cases').update({ status: 'IN_REVIEW' }).in('id', selectedTCIds)
        selectedTCIds.forEach(tcId => store.updateTestCase(tcId, { status: 'IN_REVIEW' }))

        if (reviewerId !== currentUser.id) {
          createNotification(supabase, store.addNotification, {
            userId: reviewerId,
            title: 'Review Assigned',
            message: `You have been assigned ${selectedTCIds.length} test cases for review.`,
            link: `/projects/${projectId}/reviews`
          })
        }
      }
    } catch(err) {
      console.error(err)
    } finally {
      setSelectedTCIds([])
      setIsSubmitting(false)
    }
  }

  async function addComment(reviewId: string) {
    if (!comment.trim() || isSubmitting) return
    setIsSubmitting(true)

    try {
      // In Supabase we'd typically have a `review_comments` table or insert JSON. 
      // Assuming a `review_comments` separate table was built conceptually, or jsonb columns:
      // Realistically we need an RPC or a secondary insert. In our schema `review_cycles` does not natively embed comments.
      // Assuming 'comments' is JSONB in 'review_cycles', we fetch it and append.
      const rc = store.reviewCycles.find(r => r.id === reviewId)
      if (!rc) return

      const newComment = {
        id: `cm${Date.now()}`, // Temporary fast ID for JSONB payloads
        author_id: currentUser.id,
        comment: comment.trim(),
        created_at: new Date().toISOString(),
      }

      const updatedComments = [...(rc.comments || []), newComment]

      const { error } = await supabase.from('review_cycles').update({ comments: updatedComments }).eq('id', reviewId)

      if (!error) {
        store.updateReviewCycle(reviewId, { comments: updatedComments as ReviewComment[] })
        setActiveReview(prev => prev ? { ...prev, comments: updatedComments as ReviewComment[] } : prev)
        setComment('')
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateStatus(reviewId: string, status: 'APPROVED' | 'REJECTED', tcId: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    try {
      const now = new Date().toISOString()
      const { error: err1 } = await supabase.from('review_cycles').update({ status, resolved_at: now }).eq('id', reviewId)
      const { error: err2 } = await supabase.from('test_cases').update({ status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED' }).eq('id', tcId)
      
      if (!err1 && !err2) {
        store.updateReviewCycle(reviewId, { status, resolved_at: now })
        store.updateTestCase(tcId, { status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED' })
        setActiveReview(prev => prev ? { ...prev, status } : prev)

        const rc = store.reviewCycles.find(r => r.id === reviewId)
        const tc = store.testCases.find(t => t.id === tcId)
        if (rc && tc && rc.assigned_by !== currentUser.id) {
          createNotification(supabase, store.addNotification, {
            userId: rc.assigned_by,
            title: `Review ${status}`,
            message: `Test case "${tc.title}" has been ${status.toLowerCase()}.`,
            link: `/projects/${projectId}/test-cases`
          })
        }
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Reviews</span>
          </div>
          <h1 className="page-title">Review Workflow</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Submit for Review Panel ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" /> Submit for Review
            </h3>
            <span className="badge bg-secondary text-secondary-foreground text-xs">
              {store.currentUser.full_name}
            </span>
          </div>
          <div className="card-body space-y-4">

            {/* Reviewer picker */}
            <div>
              <label className="form-label">Assign Reviewer</label>
              <select id="reviewer-select" className="form-input" value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
                <option value="">Select reviewer</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.full_name} ({l.global_role.replace('_', ' ')})</option>)}
              </select>
            </div>

            {/* Bulk TC selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">
                  My Test Cases
                  <span className="ml-2 text-xs text-muted-foreground font-normal">({submittableTCs.length} ready to submit)</span>
                </label>
                {submittableTCs.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {allSelected
                      ? <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                      : <><Square className="w-3.5 h-3.5" /> Select All</>
                    }
                  </button>
                )}
              </div>

              <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                {submittableTCs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 px-4">
                    {myTCs.length === 0
                      ? 'You have no test cases in this project yet.'
                      : 'All your test cases are already submitted or approved.'}
                  </p>
                )}
                {submittableTCs.map(tc => {
                  const selected = selectedTCIds.includes(tc.id)
                  return (
                    <label
                      key={tc.id}
                      className={cn(
                        'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50',
                        selected ? 'bg-accent/30' : ''
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 flex-shrink-0 accent-primary"
                        checked={selected}
                        onChange={() => toggleTC(tc.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{tc.title}</div>
                        <div className="text-xs text-muted-foreground">{tc.priority} · {tc.automation_status.replace('_', '-')}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <button
              id="assign-review-btn"
              className="btn-primary w-full"
              onClick={assignReview}
              disabled={selectedTCIds.length === 0 || !reviewerId}
            >
              <Plus className="w-4 h-4" />
              Submit {selectedTCIds.length > 0 ? `${selectedTCIds.length} Test Case${selectedTCIds.length > 1 ? 's' : ''}` : 'Selected'} for Review
            </button>
          </div>
        </div>

        {/* ── Status Pipeline ── */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Review Status</h3></div>
          <div className="card-body">
            <div className="flex items-center gap-2 text-xs font-medium mb-4 flex-wrap">
              {['DRAFT', 'IN_REVIEW', 'APPROVED'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={cn('badge', STATUS_COLORS[s])}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</span>
                  {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              ))}
              <span className="text-muted-foreground">or</span>
              <span className={cn('badge', STATUS_COLORS['REJECTED'])}>Rejected</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet.</p>}
              {reviews.map(rc => {
                const tc = allProjectTCs.find(t => t.id === rc.test_case_id)
                const author = store.profiles.find(p => p.id === tc?.created_by)
                const reviewer = store.profiles.find(p => p.id === rc.reviewer_id)
                return (
                  <div
                    key={rc.id}
                    className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', activeReview?.id === rc.id ? 'bg-accent/40 border-primary/30' : '')}
                    onClick={() => setActiveReview(rc)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{tc?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        By: {author?.full_name || '—'} · Reviewer: {reviewer?.full_name || 'Unknown'}
                      </div>
                    </div>
                    <span className={cn('badge flex-shrink-0', STATUS_COLORS[rc.status])}>{rc.status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Review Comment Thread ── */}
      {activeReview && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Review: {allProjectTCs.find(t => t.id === activeReview.test_case_id)?.title}
            </h3>
            <div className="flex gap-2">
              {activeReview.status === 'PENDING' && (currentUser.id === activeReview.reviewer_id || currentUser.global_role === 'ADMIN') && (
                <>
                  <button id="approve-btn" className="btn-primary btn-sm flex items-center gap-1" onClick={() => updateStatus(activeReview.id, 'APPROVED', activeReview.test_case_id)}>
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button id="reject-btn" className="btn-destructive btn-sm flex items-center gap-1" onClick={() => updateStatus(activeReview.id, 'REJECTED', activeReview.test_case_id)}>
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </>
              )}
              <span className={cn('badge', STATUS_COLORS[activeReview.status])}>{activeReview.status}</span>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {(!activeReview.comments || activeReview.comments.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
              )}
              {activeReview.comments?.map(c => (
                <div key={c.id} className={cn('flex gap-3', c.author_id === store.currentUser.id ? 'flex-row-reverse' : '')}>
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{(c.author?.full_name || 'U').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className={cn('max-w-xs', c.author_id === store.currentUser.id ? 'items-end' : '')}>
                    <div className={cn('rounded-xl px-3 py-2 text-sm', c.author_id === store.currentUser.id ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm')}>
                      {c.comment}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{c.author?.full_name} · {formatDateTime(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="review-comment-input"
                className="form-input flex-1"
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment(activeReview.id) } }}
              />
              <button id="send-comment-btn" className="btn-primary" onClick={() => addComment(activeReview.id)}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
