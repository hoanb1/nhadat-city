export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true" aria-label="Đang tải...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-img pulse" />
          <div className="skeleton-body">
            <div className="skeleton-line pulse" style={{ width: '80%' }} />
            <div className="skeleton-line pulse" style={{ width: '50%' }} />
            <div className="skeleton-line pulse" style={{ width: '65%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
