export default function DayBadge({ day }) {
  if (day !== 1 && day !== 2) {
    return <span className="day-badge day-badge--off">Outside event dates</span>;
  }
  return <span className={`day-badge day-badge--day${day}`}>Day {day}</span>;
}
