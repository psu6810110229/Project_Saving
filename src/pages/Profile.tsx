import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AvatarUpload } from '../components/AvatarUpload/AvatarUpload';
import { Button } from '../components/Button/Button';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { CreateProjectForm } from '../components/CreateProjectForm/CreateProjectForm';
import { FormField } from '../components/FormField/FormField';
import {
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconEdit,
  IconGear,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
  IconTrash,
  IconUser,
} from '../components/Icon/Icon';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { ProfileHeader } from '../components/ProfileHeader/ProfileHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { TextInput } from '../components/TextInput/TextInput';
import { ThemeSwatchPicker } from '../components/ThemeSwatchPicker/ThemeSwatchPicker';
import { VersionBadge } from '../components/VersionBadge/VersionBadge';
import { useAuth } from '../hooks/useAuth';
import { useSharedData } from '../hooks/useSharedData';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useI18n } from '../i18n/useI18n';
import { LANGUAGE_NATIVE_LABEL, SUPPORTED_LANGUAGES, type Language } from '../i18n/languages';
import { fallbackInitial } from '../lib/dashboardStats';
import { haptic } from '../lib/haptics';
import type { ThemeSwatch } from '../lib/theme';
import type { ProjectCategory } from '../types';

type ProfileModal = 'profile' | 'create-project' | 'join-project' | 'language' | null;

export function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { createRoom, joinRoomByCode, leaveRoom } = useRooms();
  const data = useSharedData();
  const { profile, loading, error, themeColor, updateProfile, uploadAvatar, updateLanguage } = data.profile;
  const { copy, language, setLanguage } = useI18n();
  const [activeModal, setActiveModal] = useState<ProfileModal>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [pendingCreateValues, setPendingCreateValues] = useState<{ existingName: string; existingRoomId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [themeDraft, setThemeDraft] = useState<ThemeSwatch | null>(null);
  const [projectCategory, setProjectCategory] = useState<ProjectCategory | null>('travel');
  const [projectName, setProjectName] = useState('Japan 2027');
  const [projectTarget, setProjectTarget] = useState('100000');
  const [projectEndDate, setProjectEndDate] = useState('2027-11-01');
  const [joinCode, setJoinCode] = useState('');
  const projectOptions = projectOptionIcons.map(({ id, icon }) => ({
    id,
    icon,
    label: copy.profile.projectCategories[id],
  }));

  // Manage Project -> "Create another project" links here with an
  // ?intent=create-project query param. Opening the modal is the only
  // job; strip the param afterwards so a refresh doesn't keep re-opening it.
  useEffect(() => {
    if (searchParams.get('intent') !== 'create-project') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModal('create-project');
    const next = new URLSearchParams(searchParams);
    next.delete('intent');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (loading) return <ProfileSkeleton ariaLabel={copy.common.loadingProfile} />;
  if (error) return <StatusCard title={copy.profile.errorTitle} body={error} />;

  async function handleLanguageChange(next: Language) {
    if (next !== language) setLanguage(next);
    closeModal();
    if (user) {
      const result = await updateLanguage(next);
      if (result.error) setMessage(result.error);
    }
  }

  const displayName = displayNameDraft ?? profile?.display_name ?? '';
  const theme = themeDraft ?? themeColor;
  const canLeaveFromProfile = Boolean(activeRoom && activeRoom.created_by !== user?.id);

  function openModal(next: ProfileModal) {
    setActiveModal(next);
    setMessage(null);
  }

  function closeModal() {
    setActiveModal(null);
    setMessage(null);
  }

  async function handleProfileSave() {
    const result = await updateProfile({ display_name: displayName, theme_color: theme });
    if (!result.error) {
      setDisplayNameDraft(null);
      setThemeDraft(null);
    }
    setMessage(result.error ?? copy.profile.profileUpdated);
  }

  async function handleAvatarUpload(file: File) {
    const result = await uploadAvatar(file);
    if (!result.error) return result;
    if (result.error === 'Please choose an image file.') {
      return { error: copy.sharedControls.imageTypeError };
    }
    if (result.error === 'Image must be smaller than 5 MB.') {
      return { error: copy.sharedControls.imageSizeError };
    }
    return result;
  }

  async function handleCreateProject(options: { archiveExisting?: boolean } = {}) {
    const target = Number(projectTarget);
    if (!projectCategory || !projectName.trim() || !projectEndDate || target <= 0) {
      setMessage(copy.profile.projectDetailsValidation);
      return;
    }
    const result = await createRoom({
      name: projectName,
      target_amount: target,
      end_date: projectEndDate,
      category: projectCategory,
    }, options);
    if (result.conflict) {
      setPendingCreateValues(result.conflict);
      return;
    }
    if (result.error) setMessage(result.error);
    else {
      haptic('milestone');
      setPendingCreateValues(null);
      closeModal();
      navigate('/dashboard');
    }
  }

  async function handleJoinProject() {
    const result = await joinRoomByCode(joinCode);
    if (result.error) setMessage(result.error);
    else {
      closeModal();
      navigate('/dashboard');
    }
  }

  async function handleLeaveProject() {
    if (!activeRoomId) return;
    const result = await leaveRoom(activeRoomId);
    if (result.error) {
      setMessage(result.error);
      setConfirmingLeave(false);
      return;
    }
    setConfirmingLeave(false);
    navigate('/profile');
  }



  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={copy.profile.pageEyebrow} title={copy.profile.pageTitle} subtitle={activeRoom?.name ?? copy.profile.pageSubtitleFallback} />
      <ProfileHeader
        name={profile?.display_name ?? copy.profile.youFallback}
        fallback={fallbackInitial(profile?.display_name)}
        avatarUrl={profile?.avatar_url}
        memberLabel={copy.profile.profileMember(activeRoom?.name ?? copy.profile.noActiveProject)}
        themeColor={themeColor}
        onEdit={() => openModal('profile')}
      />
      {message && <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
      <SettingsList
        items={[
          {
            id: 'language',
            icon: <IconGear size={18} />,
            label: copy.profile.languageLabel,
            description: copy.profile.languageDescription,
            meta: LANGUAGE_NATIVE_LABEL[language],
            onClick: () => openModal('language'),
          },
          { id: 'notifications', icon: <IconBell size={18} />, label: copy.profile.notificationSettingsLabel, description: copy.profile.notificationSettingsDescription, onClick: () => navigate('/notifications/settings') },
          { id: 'manage-project', icon: <IconCalendar size={18} />, label: copy.profile.manageProjectLabel, description: copy.profile.manageProjectDescription(activeRoom?.name ?? copy.profile.noActiveProject), onClick: () => navigate('/manage-project') },
          ...(!activeRoom ? [{ id: 'join', icon: <IconBell size={18} />, label: copy.profile.joinProjectLabel, description: copy.profile.joinProjectDescription, onClick: () => openModal('join-project') }] : []),
          ...(canLeaveFromProfile ? [{
            id: 'leave-project',
            icon: <IconTrash size={18} />,
            label: copy.profile.leaveProjectLabel,
            description: copy.profile.leaveProjectDescription,
            onClick: () => setConfirmingLeave(true),
          }] : []),
        ]}
        archiveItem={{ id: 'signout', icon: <IconUser size={18} />, label: copy.profile.signOutLabel, onClick: () => setConfirmingSignOut(true) }}
      />
      <VersionBadge />
      <Modal open={activeModal === 'profile'} title={copy.profile.editProfileModalTitle} onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <AvatarUpload
            avatarUrl={profile?.avatar_url ?? null}
            fallback={fallbackInitial(profile?.display_name)}
            onUpload={handleAvatarUpload}
          />
          <FormField label={copy.profile.displayNameLabel}>
            <TextInput value={displayName} leadingIcon={<IconEdit size={16} />} onChange={event => setDisplayNameDraft(event.target.value)} />
          </FormField>
          <ThemeSwatchPicker value={theme} onChange={setThemeDraft} />
          <Button variant="primary" fullWidth onClick={handleProfileSave}>{copy.profile.saveProfileButton}</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'create-project'} title={copy.createProject.sectionLabel} onClose={closeModal}>
        <CreateProjectForm
          category={projectCategory}
          options={projectOptions}
          name={projectName}
          target={projectTarget}
          endDate={projectEndDate}
          onCategoryChange={setProjectCategory}
          onNameChange={setProjectName}
          onTargetChange={value => setProjectTarget(value.replace(/[^0-9]/g, ''))}
          onEndDateChange={setProjectEndDate}
          onSubmit={handleCreateProject}
        />
      </Modal>
      <Modal open={activeModal === 'language'} title={copy.profile.languageModalTitle} onClose={closeModal}>
        <div className="flex flex-col gap-2">
          {SUPPORTED_LANGUAGES.map(option => {
            const isActive = option === language;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleLanguageChange(option)}
                className="w-full flex items-center justify-between gap-3 rounded-lg bg-surface shadow-soft p-3 active:scale-[0.99] transition-transform text-left"
                aria-pressed={isActive}
              >
                <span className="font-mono text-sm font-bold text-ink">{LANGUAGE_NATIVE_LABEL[option]}</span>
                {isActive && <IconCheck size={18} className="text-brand-600" />}
              </button>
            );
          })}
        </div>
      </Modal>
      <Modal open={activeModal === 'join-project'} title={copy.joinProject.modalTitle} onClose={closeModal}>
        <JoinProjectFlow
          code={joinCode}
          error={joinCode.length > 0 && joinCode.length < 6 ? copy.profile.joinCodeValidation : undefined}
          preview={joinCode.length >= 6 ? joinPreview(joinCode, copy) : null}
          onCodeChange={setJoinCode}
          onJoin={handleJoinProject}
        />
      </Modal>
      <ConfirmModal
        open={confirmingSignOut}
        title={copy.profile.signOutConfirmTitle}
        body={copy.profile.signOutConfirmBody}
        confirmLabel={copy.profile.signOutLabel}
        danger
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={signOut}
      />
      <ConfirmModal
        open={confirmingLeave}
        title={copy.profile.leaveConfirmTitle}
        body={copy.profile.leaveConfirmBody}
        confirmLabel={copy.profile.leaveProjectLabel}
        danger
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={handleLeaveProject}
      />
      <ConfirmModal
        open={Boolean(pendingCreateValues)}
        title={copy.profile.archiveCurrentTitle}
        body={pendingCreateValues
          ? copy.profile.archiveCurrentBody(pendingCreateValues.existingName)
          : ''}
        confirmLabel={copy.profile.archiveContinueLabel}
        danger
        onCancel={() => setPendingCreateValues(null)}
        onConfirm={() => handleCreateProject({ archiveExisting: true })}
      />
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  const { copy } = useI18n();
  return (
    <section className="rounded-xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">{copy.profile.errorSection}</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function ProfileSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="flex flex-col gap-6" aria-label={ariaLabel}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16 rounded-pill" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-44 rounded-pill" />
        </div>
        <Spinner size="sm" tone="neutral" />
      </div>
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48 rounded-pill" />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </section>
    </div>
  );
}

const projectOptionIcons = [
  { id: 'travel' as const, icon: <IconPlane size={28} /> },
  { id: 'gadget' as const, icon: <IconSmartphone size={28} /> },
  { id: 'wedding' as const, icon: <IconHeart size={28} /> },
  { id: 'home' as const, icon: <IconHome size={28} /> },
  { id: 'other' as const, icon: <IconBriefcase size={28} /> },
];

function joinPreview(code: string, copy: ReturnType<typeof useI18n>['copy']) {
  return {
    icon: <IconPlane size={32} />,
    name: copy.projectSetup.inviteName(code.toUpperCase()),
    creatorName: copy.projectSetup.projectOwner,
    creatorFallback: 'P',
    memberCount: 2,
  };
}
