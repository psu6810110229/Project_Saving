interface VersionBadgeProps {
  version?: string;
}

export function VersionBadge({ version = __APP_VERSION__ }: VersionBadgeProps) {
  return (
    <p className="self-center rounded-pill bg-brand-50 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-brand-800">
      {formatVersion(version)}
    </p>
  );
}

function formatVersion(version: string) {
  const prerelease = version.match(/^0\.(\d+)\.(\d+)-([a-z]+)\.\d+$/i);
  if (prerelease) return `${prerelease[3].toLowerCase()} ${prerelease[1]}.${prerelease[2]}`;
  return version;
}
