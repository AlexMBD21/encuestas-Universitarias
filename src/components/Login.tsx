import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthAdapter from '../services/AuthAdapter'
import { useAuth } from '../services/AuthContext'
import Loader from './Loader'
import initLegacyLogin from '../legacy/loginLegacy'

export default function Login() {
  const [showModal, setShowModal] = useState(false)
  const { user, loading } = useAuth()
  const [role, setRole] = useState<'student' | 'profesor'>('profesor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const timerRef = useRef<number | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const validateTimerRef = useRef<number | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    // Si hay usuario autenticado, redirigir automáticamente (a menos que estemos en la animación de éxito)
    if (!loading && user && !isSuccess) {
      if (user.role === 'profesor') navigate('/profesor', { replace: true })
      else if (user.role === 'estudiante') navigate('/estudiante', { replace: true })
    }

    try {
      initLegacyLogin()
    } catch (e) {
      // fail silently
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, navigate])

  // On mount, clear any leftover demo autofill values
  useEffect(() => {
    const demoEmails = ['student@example.com', 'teacher@example.com', 'prof.nuevo@example.com']
    if (demoEmails.includes(email)) setEmail('')
    if (password && (password === 'password' || password === 'nuevo123')) setPassword('')
  }, [])

  const continueSession = () => {
    try {
      const cached = (window as any).Utils && (window as any).Utils.getUserData ? (window as any).Utils.getUserData() : AuthAdapter.getUser()
      if (!cached) return setShowModal(false)
      if (cached.role === 'profesor') window.location.href = '/profesor'
      else if (cached.role === 'estudiante') window.location.href = '/estudiante'
      else setShowModal(false)
    } catch (err) {
      setShowModal(false)
    }
  }

  const logoutSession = () => {
    AuthAdapter.logout()
    setShowModal(false)
    setTimeout(() => window.location.reload(), 800)
  }

  const onRoleToggle = () => setRole(r => (r === 'student' ? 'profesor' : 'student'))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isValidating) return
    setIsValidating(true)
    setMessage('')
    if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current)
    if (timerRef.current) window.clearTimeout(timerRef.current)

    try {
      const userResult: any = await AuthAdapter.login(email, password, role === 'profesor' ? 'profesor' : 'estudiante')
      setIsValidating(false)
      setIsSuccess(true)
      setMessageType('success')
      setMessage('Inicio exitoso')

      timerRef.current = window.setTimeout(() => {
        setIsSuccess(false)
        if (userResult.role === 'profesor') navigate('/profesor', { replace: true })
        else navigate('/', { replace: true })
      }, 2500)
    } catch (err) {
      setIsValidating(false)
      try {
        const code = (err && (err as any).code) ? String((err as any).code) : ''
        const msg = (err && (err as any).message) ? String((err as any).message) : ''
        let friendly = 'Error en login'
        const loweredCode = code.toLowerCase()
        const loweredMsg = msg.toLowerCase()

        if (
          loweredCode.indexOf('wrong-password') >= 0 ||
          loweredCode.indexOf('invalid-credential') >= 0 ||
          loweredCode.indexOf('user-not-found') >= 0 ||
          loweredMsg.indexOf('wrong-password') >= 0 ||
          loweredMsg.indexOf('invalid-credential') >= 0 ||
          loweredMsg.indexOf('user-not-found') >= 0
        ) {
          friendly = 'Correo electrónico o contraseña incorrectos'
        } else if (loweredCode.indexOf('invalid-email') >= 0 || loweredMsg.indexOf('invalid-email') >= 0) {
          friendly = 'Correo electrónico inválido'
        } else if (loweredCode.indexOf('too-many-requests') >= 0 || loweredMsg.indexOf('too-many-requests') >= 0) {
          friendly = 'Demasiados intentos. Intenta nuevamente más tarde.'
        } else if (loweredCode.indexOf('network-request-failed') >= 0 || loweredMsg.indexOf('network') >= 0) {
          friendly = 'Error de red. Revisa tu conexión e intenta de nuevo.'
        } else if (msg) {
          friendly = msg
        }

        setMessage(friendly)
      } catch (e) {
        setMessage((err && (err as any).message) || 'Error en login')
      }
      setMessageType('error')
    }
  }

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current)
    }
  }, [])

  if (loading) return <Loader fullScreen text="Cargando sesión..." />

  return (
    <div className="login-root fixed inset-0 z-[100] flex flex-col md:flex-row bg-[#020617] overflow-hidden font-outfit">
      {/* Cosmic Background Layer (Behind everything) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_20%_30%,_#0f172a_0%,_#020617_100%)]">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-500/30 rounded-full blur-[120px] animate-pulse-slow opacity-80"></div>
        <div className="absolute bottom-[-20%] left-[10%] w-[700px] h-[700px] bg-blue-500/20 rounded-full blur-[150px] animate-pulse-slow opacity-60" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] left-[-5%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow opacity-40" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-[10%] right-[30%] w-[300px] h-[300px] bg-indigo-400/10 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Left Section: Branding & Welcome (Desktop only) */}
      <div className="hidden md:flex flex-1 relative z-10 p-12 lg:p-20 flex-col justify-between">
        <div className="flex items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
          </div>
          <span className="text-xl font-bold text-white tracking-widest uppercase opacity-80">EduSurvey</span>
        </div>

        <div className="max-w-2xl animate-fade-in-up">
          <h1 className="text-7xl lg:text-8xl font-black bg-gradient-to-br from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent leading-[0.9] mb-8 tracking-tighter">
            Gestiona con <br /> Inteligencia.
          </h1>
          <p className="text-xl text-slate-400 font-medium max-w-lg leading-relaxed">
            Plataforma avanzada de gestión universitaria diseñada para simplificar el análisis y la toma de decisiones.
          </p>
          <div className="flex gap-4 mt-10 opacity-80">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">100%</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-200/60">Seguro</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10 mx-4"></div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white">24/7</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-200/60">Disponible</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] opacity-50">
          © 2026 EduSurvey Core • Celestial Design System
        </div>
      </div>

      {/* Toast Notification */}
      {message && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-fade-in-down">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-[24px] border backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[320px] ${
            messageType === 'success' 
              ? 'bg-emerald-600 border-emerald-500 text-white' 
              : 'bg-red-500/20 border-red-500/30 text-red-50'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
              messageType === 'success' ? 'bg-white' : 'bg-red-500'
            }`}>
              <span className={`material-symbols-outlined text-[24px] font-bold ${
                messageType === 'success' ? 'text-emerald-600' : 'text-white'
              }`}>
                {messageType === 'success' ? 'check' : 'priority_high'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {messageType === 'success' ? 'Éxito' : 'Atención'}
              </span>
              <span className="text-sm font-bold tracking-tight">{message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Right Section: Form Panel */}
      <div className="w-full md:w-[480px] lg:w-[540px] h-full relative z-20 flex items-center justify-center">
        <div className="w-full h-full bg-slate-950/40 backdrop-blur-3xl border-l border-white/10 flex flex-col justify-center p-8 lg:p-16 shadow-[-50px_0_100px_rgba(0,0,0,0.5)] relative overflow-y-auto">
          
          <div className="w-full max-w-[400px] mx-auto animate-fade-in-up py-10">
            {/* Mobile Branding (only visible on small screens) */}
            <div className="md:hidden text-center mb-10">
               <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl animate-pulse-slow"></div>
                <span className="material-symbols-outlined text-[48px] text-white relative z-10">fact_check</span>
              </div>
              <h1 className="text-4xl font-black bg-gradient-to-br from-white via-white to-indigo-400 bg-clip-text text-transparent leading-none mb-2 tracking-tighter">
                Encuestas
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestión Universitaria</p>
            </div>

            <div className="mb-10 hidden md:block">
              <h2 className="text-3xl font-black text-white mb-2">Bienvenido</h2>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">Ingresa tus credenciales para acceder a la plataforma estratégica.</p>
            </div>

            {/* Role Toggle */}
            <div className="mb-8">
              <div className="bg-white p-1.5 rounded-[24px] flex items-center relative gap-1 shadow-sm">
                <button 
                  onClick={() => setRole('student')}
                  className={`flex-1 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative z-10 ${role === 'student' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Estudiante
                </button>
                <button 
                  onClick={() => setRole('profesor')}
                  className={`flex-1 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative z-10 ${role === 'profesor' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Profesor
                </button>
                <div 
                  className={`absolute inset-y-1 bg-indigo-600 rounded-full transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${role === 'student' ? 'left-1 w-[calc(50%-4px)]' : 'left-[calc(50%+1px)] w-[calc(50%-4px)]'}`}
                ></div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2 group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">alternate_email</span>
                  </div>
                  <input 
                    required 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950/40 border-2 border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-900/80 rounded-[22px] pl-12 pr-6 py-4 text-sm font-bold transition-all outline-none text-white placeholder:text-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus:shadow-[0_0_20px_rgba(79,70,229,0.15)]"
                    placeholder="nombre@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">lock</span>
                  </div>
                  <input 
                    required 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950/40 border-2 border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-900/80 rounded-[22px] pl-12 pr-12 py-4 text-sm font-bold transition-all outline-none text-white placeholder:text-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus:shadow-[0_0_20px_rgba(79,70,229,0.15)]"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isValidating || isLoggingIn || isSuccess}
                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-[22px] shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-3 uppercase tracking-widest text-xs border border-white/10"
                  >
                    {isValidating || isLoggingIn || isSuccess? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-900/20 border-t-slate-950 rounded-full animate-spin"></div>
                        <span>{isSuccess ? 'Entrando...' : 'Validando...'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl font-bold">login</span>
                        <span>Iniciar Sesión</span>
                      </>
                    )}
                  </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
        
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-down { animation: fadeInDown 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); }
        }
        .animate-bounce-slow { animation: bounceSlow 4s ease-in-out infinite; }

        @keyframes pulseSlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        .animate-pulse-slow { animation: pulseSlow 8s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
