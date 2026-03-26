/**
 * Returns the correct "home" route for the current context.
 * If the user came from the desktop apontador panel, returns '/apontador-desktop'.
 * Otherwise returns '/mobile'.
 */
export function getApontadorHomeRoute(): string {
  return sessionStorage.getItem('apontadorDesktopMode') === 'true'
    ? '/apontador-desktop'
    : '/mobile';
}
