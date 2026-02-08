// Add this new helper
export const isScheduleOverrideActive = (user) => {
  if (!user || !user.notificationScheduleOverrideUntil) return false;
  const overrideUntil = new Date(user.notificationScheduleOverrideUntil);
  const now = new Date();
  // If the override date is in the future, we should ignore the schedule
  return now < overrideUntil;
};

export const isManualPauseActive = (user) => {
  if (!user || !user.notificationPausedUntil) return false;
  const pausedUntil = new Date(user.notificationPausedUntil);
  const now = new Date();
  return now < pausedUntil;
};

export const isOutsideNotificationSchedule = (preferences) => {
  if (!preferences || !preferences.notifications?.schedule) return false;

  const { schedule } = preferences.notifications;
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = days[now.getDay()];

  const todaySchedule = schedule.days?.find(d => d.day === currentDayName);
  // If no schedule for today or it's disabled, we treat it as "outside schedule"
  if (!todaySchedule || todaySchedule.enabled === false) return true; 

  const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    let hoursInt = parseInt(hours, 10);
    const minutesInt = parseInt(minutes, 10);
    if (modifier === 'PM' && hoursInt < 12) hoursInt += 12;
    if (modifier === 'AM' && hoursInt === 12) hoursInt = 0;
    const d = new Date();
    d.setHours(hoursInt, minutesInt, 0, 0);
    return d;
  };

  const startTime = parseTime(todaySchedule.start);
  const endTime = parseTime(todaySchedule.end);
  
  return now < startTime || now > endTime;
};