import { describe, it, expect, beforeEach, vi } from 'vitest'
import surveyHelpers from './surveyHelpers'
import AuthAdapter from './AuthAdapter'

vi.mock('./AuthAdapter', () => {
  return {
    default: {
      getUser: vi.fn(),
    }
  }
})

vi.mock('./supabaseClient', () => {
  return {
    default: {
      isEnabled: () => false,
      pushSurveyResponse: vi.fn(),
    }
  }
})

describe('surveyHelpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCurrentUserId', () => {
    it('should return user id if available', () => {
      vi.mocked(AuthAdapter.getUser).mockReturnValue({ id: '111', email: 'test@test.com' })
      expect(surveyHelpers.getCurrentUserId()).toBe('111')
    })

    it('should return email if id is missing', () => {
      vi.mocked(AuthAdapter.getUser).mockReturnValue({ email: 'test@test.com' })
      expect(surveyHelpers.getCurrentUserId()).toBe('test@test.com')
    })

    it('should return anon if user is missing', () => {
      vi.mocked(AuthAdapter.getUser).mockReturnValue(null)
      expect(surveyHelpers.getCurrentUserId()).toBe('anon')
    })
  })

  describe('hasUserRated', () => {
    it('should return false by default (no sync check)', () => {
      expect(surveyHelpers.hasUserRated('1', '2')).toBe(false)
    })
  })

  describe('saveProjectResponse', () => {
    it('should return false if database client is disabled', async () => {
      const resp = {
        surveyId: 's1',
        projectId: 'p1',
        userId: 'u1',
        answers: {},
        submittedAt: 'now',
      }
      const success = await surveyHelpers.saveProjectResponse(resp)
      expect(success).toBe(false)
    })
  })
})
