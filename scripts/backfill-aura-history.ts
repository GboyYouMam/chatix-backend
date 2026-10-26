import 'dotenv/config';
import postgres from 'postgres';

// Writes today's (UTC) aura snapshot for every user. Idempotent: re-running
// overwrites today's row with the current aura and adds nothing else.
async function main() {
  const connection = postgres(process.env.DATABASE_URL ?? '');
  try {
    const day = new Date().toISOString().slice(0, 10);
    const result = await connection`
      INSERT INTO aura_history (user_id, day, aura)
      SELECT id, ${day}::date, aura FROM users
      ON CONFLICT (user_id, day) DO UPDATE SET aura = EXCLUDED.aura
    `;
    console.log(`aura_history snapshot for ${day}: ${result.count} users`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
