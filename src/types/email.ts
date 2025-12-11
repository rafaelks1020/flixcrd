export enum EmailStatus {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

export const EMAIL_STATUS_VALUES = Object.values(EmailStatus);

export function isEmailStatus(value: unknown): value is EmailStatus {
  return typeof value === "string" && EMAIL_STATUS_VALUES.includes(value as EmailStatus);
}

export enum EmailProvider {
  MAILJET = "mailjet",
}

export const EMAIL_PROVIDER_VALUES = Object.values(EmailProvider);

export function isEmailProvider(value: unknown): value is EmailProvider {
  return typeof value === "string" && EMAIL_PROVIDER_VALUES.includes(value as EmailProvider);
}
