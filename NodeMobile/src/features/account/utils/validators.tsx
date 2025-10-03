export function validateRequired(fields: Record<string, string>) {
  const missing = Object.values(fields).some(v => !v?.trim());
  return missing ? "Please fill out all fields." : null;
}

const STRONG_PW = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export function validatePassword(password: string, confirm: string) {
  if (!STRONG_PW.test(password)) {
    return "Password must be at least 8 characters, include 1 capital letter, and 1 symbol.";
  }
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
