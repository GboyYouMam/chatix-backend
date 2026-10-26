import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import postgres from 'postgres';

async function main() {
  const connection = postgres(process.env.DATABASE_URL ?? '');
  let updated = 0;
  try {
    const rooms = await connection<{ id: string; password: string }[]>`
      SELECT id, password FROM rooms
      WHERE password IS NOT NULL AND password NOT LIKE '$2%'
    `;
    for (const room of rooms) {
      const password = await bcrypt.hash(room.password, 10);
      const result = await connection`
        UPDATE rooms SET password = ${password}
        WHERE id = ${room.id} AND password = ${room.password}
        RETURNING id
      `;
      updated += result.length;
    }
    console.log(`${updated} updated`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
