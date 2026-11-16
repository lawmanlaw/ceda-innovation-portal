// Shown while a page loads: the CEDA mark rises in, then breathes gently until content arrives
export default function Loader() {
  return (
    <div className="loader" role="status" aria-label="Loading">
      <img src="/ceda-mark.png" alt="" width={96} height={50} />
      <div className="loader-track"><span /></div>
    </div>
  );
}
