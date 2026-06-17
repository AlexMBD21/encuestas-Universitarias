import { describe, it, expect, beforeEach, vi } from 'vitest'
import AuthAdapter from './AuthAdapter'

// Mock supabaseClient
vi.mock('./supabaseClient', () => {
  return {
    default: {
      isEnabled: () => false,
      firebaseSignIn: vi.fn(),
      firebaseSignOut: vi.fn(),
      getAuthCurrentUser: vi.fn(),
    }
  }
})

describe('AuthAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    
    // Clear localStorage mock
    const store: Record<string, string> = {}
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const k in store) delete store[k] },
      length: 0,
      key: () => null,
    }

    // Mock global window object properties
    global.window = {
      dispatchEvent: vi.fn(),
      CustomEvent: class CustomEvent {
        type: string
        detail: any
        constructor(type: string, options?: any) {
          this.type = type
          this.detail = options?.detail
        }
      }
    } as any
  })

  it('should save a user to localStorage and retrieve it', () => {
    const mockUser = { id: '123', email: 'test@example.com', role: 'profesor' }
    AuthAdapter.saveUser(mockUser)

    const retrieved = AuthAdapter.getUser()
    expect(retrieved).toEqual(mockUser)
  })

  it('should dispatch auth:changed event on saveUser', () => {
    const mockUser = { id: '123', email: 'test@example.com', role: 'profesor' }
    AuthAdapter.saveUser(mockUser)
    expect(global.window.dispatchEvent).toHaveBeenCalled()
  })

  it('should remove user from localStorage on logout', async () => {
    const mockUser = { id: '123', email: 'test@example.com', role: 'profesor' }
    AuthAdapter.saveUser(mockUser)
    expect(AuthAdapter.getUser()).toEqual(mockUser)

    await AuthAdapter.logout()
    expect(AuthAdapter.getUser()).toBeNull()
  })

  it('should reject legacy login if inputs are invalid', async () => {
    await expect(AuthAdapter.login('', '', 'profesor')).rejects.toThrow('Correo inválido')
    await expect(AuthAdapter.login('invalid-email', '12', 'profesor')).rejects.toThrow('Correo inválido')
    await expect(AuthAdapter.login('valid@email.com', '12', 'profesor')).rejects.toThrow('Contraseña demasiado corta')
  })

  it('should resolve user on valid legacy login', async () => {
    const user = await AuthAdapter.login('test@example.com', 'password123', 'profesor')
    expect(user).toBeDefined()
    expect(user.email).toBe('test@example.com')
    expect(user.role).toBe('profesor')
  })
})
