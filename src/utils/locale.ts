export function getSiteLocale() { return 'fr-CH'; }
export function formatDate(date: Date | string, _style?: string) { return new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date(date)); }
