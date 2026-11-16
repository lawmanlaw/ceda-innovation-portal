// Skeleton shown while a dashboard page loads, shaped like the content that follows
export default function Loading() {
  return (
    <div className="stack" role="status" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="grid cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="sk" style={{ width: '45%' }} />
            <div className="sk" />
            <div className="sk" style={{ width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
