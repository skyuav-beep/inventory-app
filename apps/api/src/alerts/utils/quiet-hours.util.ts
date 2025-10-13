export interface QuietHoursWindow {
  startHour: number;
  endHour: number;
}

export function parseQuietHoursWindow(value: string): QuietHoursWindow {
  const match = value.match(/^([01]?\d|2[0-3])-(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid quiet hours format: ${value}`);
  }

  const startHour = Number(match[1]);
  const endHour = Number(match[2]);

  if (endHour > 23) {
    throw new Error(`Invalid quiet hours format: ${value}`);
  }

  return { startHour, endHour };
}

export function isWithinQuietHours(date: Date, window: QuietHoursWindow): boolean {
  const hour = date.getHours();

  if (window.startHour === window.endHour) {
    return false;
  }

  if (window.startHour < window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }

  return hour >= window.startHour || hour < window.endHour;
}

export function getNextQuietHoursExit(date: Date, window: QuietHoursWindow): Date {
  const result = new Date(date);

  if (window.startHour === window.endHour) {
    result.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    return result;
  }

  if (!isWithinQuietHours(date, window)) {
    return result;
  }

  result.setMinutes(0, 0, 0);

  if (window.startHour < window.endHour) {
    result.setHours(window.endHour);
    if (result <= date) {
      result.setDate(result.getDate() + 1);
    }
  } else {
    result.setHours(window.endHour);
    if (result <= date) {
      result.setDate(result.getDate() + 1);
    }
  }

  return result;
}
