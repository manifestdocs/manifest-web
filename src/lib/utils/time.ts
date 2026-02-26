export function getTimeBucket(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    // Compare calendar days, not just time difference
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const diffCalendarDays = Math.floor(
        (today.getTime() - entryDay.getTime()) / 86400000,
    );

    if (diffMins < 5) return 'just now';
    if (diffMins < 60)
        return `${Math.floor(diffMins / 15) * 15 || 15} mins ago`;
    if (diffCalendarDays === 0 && diffHours === 1) return '1 hour ago';
    if (diffCalendarDays === 0 && diffHours < 4)
        return `${diffHours} hours ago`;
    if (diffCalendarDays === 0) return 'earlier today';
    if (diffCalendarDays === 1) return 'yesterday';
    if (diffCalendarDays < 7) return `${diffCalendarDays} days ago`;
    if (diffCalendarDays < 14) return '1 week ago';
    if (diffCalendarDays < 28)
        return `${Math.floor(diffCalendarDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}
