// A person's profile photo, or their initials on CEDA maroon when there is none
export default function Avatar({ id, name, v, size = 32 }: { id: string; name?: string | null; v?: number | null; size?: number }) {
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return v
    ? <img className="avatar" src={`/app/avatar/${id}?v=${v}`} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="avatar initials" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}
