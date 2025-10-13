export function buildTestAlertMessage(requestedBy: string): string {
  const timestamp = new Date().toISOString();
  return `[TEST] Inventory alert requested by ${requestedBy} at ${timestamp}`;
}
