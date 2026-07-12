export function normalizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) {
    return undefined;
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 7) {
    return undefined;
  }

  return digits.startsWith('00') ? digits.slice(2) : digits;
}
