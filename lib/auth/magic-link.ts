export function createMagicLinkOptions(origin: string) {
  return {
    shouldCreateUser: false,
    emailRedirectTo: new URL('/auth/callback', origin).toString(),
  };
}
