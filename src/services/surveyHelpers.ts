import AuthAdapter from './AuthAdapter'
import supabaseClient from './supabaseClient'

export type RubricQuestion = {
  id: string
  text: string
  kind: 'score' | 'text'
}

export type Project = {
  id: string
  name: string
  category?: string
  description?: string
}

export type ProjectResponse = {
  surveyId: string
  projectId: string
  userId: string
  answers: Record<string, number | string | null>
  submittedAt: string
}

export function getCurrentUserId() {
  try {
    const u = AuthAdapter.getUser()
    return (u && (u.id || u.email || u.name)) || 'anon'
  } catch (e) {
    return 'anon'
  }
}

export function hasUserRated(surveyId: string, projectId: string, userId?: string) {
  try {
    // localStorage fallback removed; cannot determine synchronously from DB
    // Return false by default — consumers should use DB-aware flows instead
    return false
  } catch (e) {
    return false
  }
}

export async function saveProjectResponse(resp: ProjectResponse) {
  try {
    // Prefer Supabase when available, otherwise fallback to Firebase
    const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
    const dataClient: any = supabaseEnabledNow ? supabaseClient : null
    if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled()) {
      if ((dataClient as any).pushSurveyResponse) {
        await (dataClient as any).pushSurveyResponse(resp)
        return true
      }
      console.error('dataClient.pushSurveyResponse not available')
      return false
    }
    // No DB backend enabled: refuse to persist
    console.error('No DB backend enabled: not saving project response')
    return false
  } catch (e) {
    console.error('saveProjectResponse', e)
    return false
  }
}

export function getResponsesForSurvey(surveyId: string) {
  try {
    // Responses are stored in Firebase RTDB. Synchronous local read removed.
    return []
  } catch (e) { return [] }
}

export function hasUserResponded(surveyId: string, userId?: string) {
  try {
    const uid = userId || getCurrentUserId()
    // Synchronous check removed; return false by default. Use Firebase-aware helpers where possible.
    return false
  } catch (e) { return false }
}

export function getResponsesForProject(surveyId: string, projectId: string) {
  try {
    return []
  } catch (e) { return [] }
}

export function getProgressForUser(surveyId: string, totalProjects: number, userId?: string) {
  try {
    const uid = userId || getCurrentUserId()
    // Synchronous progress computation removed; return neutral defaults
    return { rated: 0, total: totalProjects }
  } catch (e) { return { rated: 0, total: totalProjects } }
}

export default {
  getCurrentUserId,
  hasUserRated,
  saveProjectResponse,
  getResponsesForSurvey,
  getResponsesForProject,
  getProgressForUser
  , hasUserResponded
}
