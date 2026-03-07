/**
 * Run with: npx tsx db/seed.ts
 * Default seed is intentionally minimal.
 * Household-specific categories, budgets, and rules are created during `/setup`.
 */

async function main() {
  console.log('Seed complete. Finish app configuration in /setup after signing in.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
