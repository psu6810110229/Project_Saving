import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center p-4 overflow-hidden bg-ink">
      {/* Dynamic Animated Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-terracotta/40 blur-[100px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-[30%] -right-[10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full bg-purple-600/30 blur-[100px] animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-[380px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 pb-10 shadow-2xl flex flex-col items-center animate-fade-in-up">
        
        {/* Floating App Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-terracotta to-purple-600 flex items-center justify-center shadow-lg shadow-terracotta/30 mb-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="text-4xl font-black text-white drop-shadow-md">G</span>
        </div>

        <div className="text-center mb-10 w-full">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2 drop-shadow-sm">
            GOOUT
          </h1>
          <p className="text-white/60 text-sm font-medium">
            Enter the arena. Conquer your goals.
          </p>
        </div>

        {/* Premium Button */}
        <button
          onClick={signInWithGoogle}
          className="relative w-full group overflow-hidden rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="relative flex items-center justify-center gap-4 w-full px-5 py-4">
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none" className="drop-shadow-sm">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span className="text-white font-bold tracking-wide text-[15px]">Continue with Google</span>
          </div>
        </button>
      </div>
    </div>
  );
}
