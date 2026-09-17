export function signUnsubscribeToken(
  secretBase64: string,
  fanId: string,
  creatorId: string,
  issuedAt?: Date,
): Promise<string>
