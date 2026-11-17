import { AvatarArt, AVATARS } from '@/components/avatar-art';

// Profile photo first, then a chosen drawn avatar, then initials on CEDA maroon
export default function Avatar({ id, name, v, avatar, size = 32 }: { id: string; name?: string | null; v?: number | null; avatar?: string | null; size?: number }) {
  if (v) return <img className="avatar" src={`/app/avatar/${id}?v=${v}`} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  if (avatar && AVATARS[avatar]) return <AvatarArt name={avatar} size={size} />;
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return <span className="avatar initials" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}
