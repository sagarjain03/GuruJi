/**
 * Seed entrypoint.
 *
 * Phase 1 has no content to seed — topics, patterns, the roadmap tree and the
 * problem bank all arrive in Phase 2, where this becomes idempotent (`upsert`
 * by slug) so a re-run never duplicates a row.
 */
async function main(): Promise<void> {
  console.warn('No seed data yet — content models land in Phase 2.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
