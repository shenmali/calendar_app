export function isAllowedEmail(email: string, allowedEmail: string) {
  return (
    email.trim().toLocaleLowerCase('en-US') ===
    allowedEmail.trim().toLocaleLowerCase('en-US')
  );
}
