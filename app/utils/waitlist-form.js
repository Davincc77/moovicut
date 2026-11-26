/** Join-the-list gate. The client refuses only what the server could never read (nothing typed);
 *  the email FORMAT is judged by the server alone (server/waitlist.mjs), so the two can never disagree.
 *  Named refusal, same idea as the API: the key names the problem. Golds: tests/fixtures/long-form-golds.json. */
export function emailGate(value) {
  return String(value ?? '').trim() ? { ok: true } : { ok: false, key: 'email_missing' }
}
