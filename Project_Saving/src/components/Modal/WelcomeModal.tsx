import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Modal } from './Modal';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const { profile } = useAuth();
  
  // Steps: 1 = Name, 2 = Avatar
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Initialize state only when modal opens
  useEffect(() => {
    if (open) {
      // We don't reset step here because a profile update mid-flow would trigger this and reset to step 1.
      setDisplayName(prev => prev || profile?.display_name || '');
      setAvatarPreview(prev => prev || profile?.avatar_url || null);
    }
  }, [open]);

  const handleSaveName = async () => {
    if (!profile) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError('Please enter a nickname to continue.');
      return;
    }
    
    setSavingName(true);
    setNameError('');
    
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', profile.id);
      
    await supabase.auth.updateUser({ data: { full_name: trimmed, name: trimmed } });
    
    setSavingName(false);
    
    if (error) {
      setNameError(error.message);
    } else {
      // Smoothly transition to next step
      setStep(2);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    
    setAvatarUploading(true);
    try {
      // Show preview immediately for smooth UI
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);

      const ext = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar_${Date.now()}.${ext}`;
      
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
        
      if (upErr) throw upErr;
      
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      await supabase.auth.updateUser({ 
        data: { 
          avatar_url: data.publicUrl,
          has_completed_onboarding: true
        } 
      });
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      
      // Successfully uploaded!
      setTimeout(() => {
        setAvatarUploading(false);
        onClose(); // Auto close after success
      }, 800);

    } catch (err: any) {
      alert('Error uploading avatar: ' + err.message);
      setAvatarUploading(false);
    }
  };

  const handleSkipAvatar = async () => {
    await supabase.auth.updateUser({ data: { has_completed_onboarding: true } });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="relative w-full max-w-sm mx-auto p-8 overflow-hidden min-h-[360px] flex flex-col justify-center items-center">
        
        {/* Step 1: Nickname */}
        {step === 1 && (
          <div className="flex flex-col items-center w-full animate-scale-in">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-6 shadow-soft animate-fade-in-up">
              <span className="text-2xl">👋</span>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              Welcome to the Arena
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              Choose a battle name to display on the leaderboard.
            </p>

            <div className="w-full flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter your nickname..."
                className="w-full bg-slate-100/80 border border-slate-200 rounded-[1.25rem] px-5 py-4 text-slate-900 text-base outline-none focus:ring-2 focus:ring-terracotta/20 focus:border-terracotta transition-all text-center font-bold"
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              />
              {nameError && <p className="text-red-500 text-xs text-center">{nameError}</p>}
              
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="w-full bg-terracotta text-white rounded-xl py-3 text-sm font-bold shadow-soft hover:shadow-md active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {savingName ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Avatar */}
        {step === 2 && (
          <div className="flex flex-col items-center w-full animate-slide-in-right">
            <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
              Make Your Mark
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8">
              Upload a profile picture to stand out.
            </p>

            <label className="relative cursor-pointer group mb-8 block">
              <div className={`w-28 h-28 rounded-full overflow-hidden shadow-soft transition-transform duration-300 ${avatarUploading ? 'scale-95 opacity-80' : 'group-hover:scale-105'}`}>
                <img 
                  src={avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=D4651A&color=fff`} 
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-xs text-white font-bold tracking-widest uppercase">Upload</span>
              </div>
              
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleAvatarUpload} 
                disabled={avatarUploading}
              />
            </label>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={handleSkipAvatar}
                disabled={avatarUploading}
                className="w-full bg-slate-100/50 border border-slate-200 text-slate-500 rounded-xl py-3 text-sm font-bold hover:bg-slate-200/50 active:scale-95 transition-all"
              >
                Skip for now
              </button>
            </div>
            
            {avatarUploading && (
              <p className="text-terracotta text-xs font-semibold mt-4 animate-pulse">
                Uploading and saving...
              </p>
            )}
          </div>
        )}

        {/* Progress Indicator */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-all duration-500 ${step === 1 ? 'bg-terracotta w-4' : 'bg-border'}`} />
          <div className={`w-2 h-2 rounded-full transition-all duration-500 ${step === 2 ? 'bg-terracotta w-4' : 'bg-border'}`} />
        </div>
      </div>
    </Modal>
  );
}
