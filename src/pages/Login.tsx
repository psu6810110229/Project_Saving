import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AboutModal } from '../components/AboutInfo/AboutInfo';
import { IconButton } from '../components/IconButton/IconButton';
import { IconInfo } from '../components/Icon/Icon';
import { MOTION_EASE } from '../lib/motion';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';

export function Login() {
  const { signInWithGoogle } = useAuth();
  const { copy, language } = useI18n();
  const reduceMotion = useReducedMotion();
  const [aboutOpen, setAboutOpen] = useState(false);
  const loginTitleLines = language === 'th'
    ? ['เก็บเงินด้วยกัน', 'ถึงเป้าไปด้วยกัน']
    : [copy.auth.loginTitle];

  // Staggered entrance for the hero stack. Reduced motion collapses every
  // step to a plain fade so nothing slides.
  const rise = (delay: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15, delay } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, delay, ease: MOTION_EASE.emphasized },
        };

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-bg px-6 pb-10 pt-6">
      {/* Top bar — the (i) opens the same About/Terms/Privacy modal as the
          terms line below the sign-in button. */}
      <div className="relative z-10 flex justify-end">
        <IconButton ariaLabel={copy.about.infoAriaLabel} size="md" onClick={() => setAboutOpen(true)}>
          <IconInfo size={20} />
        </IconButton>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          {...rise(0)}
          className="overflow-hidden rounded-[1.75rem] shadow-haloOrange"
        >
          <img
            src="/icon-512.png"
            alt="GO-OUT"
            className="h-24 w-24 rounded-[1.75rem] object-cover"
          />
        </motion.div>
        <motion.span
          {...rise(0.08)}
          className="mt-1 font-mono text-sm font-bold uppercase tracking-[0.42em] text-brand-700"
        >
          
        </motion.span>
        <motion.h1 {...rise(0.16)} className="mt-4 font-mono text-[1.4rem] tracking-[0.03em] font-semibold leading-tight text-ink sm:text-3xl">
          {loginTitleLines.map((line, index) => (
            <span key={`${line}-${index}`} className="block whitespace-nowrap">
              {line}
            </span>
          ))}
        </motion.h1>
        <motion.p {...rise(0.24)} className="mt-3 whitespace-nowrap font-mono text-sm leading-6 text-ink-muted">
          {copy.auth.loginBody}
        </motion.p>
      </div>

      {/* Bottom CTA — anchored in the thumb zone */}
      <motion.div {...rise(0.34)} className="relative z-10 flex flex-col items-center gap-4">
        <button
          onClick={signInWithGoogle}
          className="
            w-full max-w-sm rounded-pill bg-brand-800 text-ink-inverse
            px-5 py-3.5 text-sm font-bold tracking-wide
            shadow-soft hover:shadow-haloOrange
            active:scale-[0.99] transition-all
            flex items-center justify-center gap-3
          "
        >
          <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden>
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {copy.auth.continueWithGoogle}
        </button>

        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="whitespace-nowrap px-2 text-center font-mono text-[11px] leading-5 text-ink-muted underline decoration-brand-200 underline-offset-2 hover:text-ink"
        >
          {copy.about.termsLine}
        </button>
      </motion.div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
