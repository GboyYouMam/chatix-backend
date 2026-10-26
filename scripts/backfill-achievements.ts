import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const connection = postgres(process.env.DATABASE_URL ?? '');
  let granted = 0;
  try {
    await connection`UPDATE users u SET
      messages_count = (SELECT count(*)::int FROM messages m WHERE m.author_id = u.id),
      respect_count = (SELECT count(*)::int FROM profile_respects r WHERE r.profile_user_id = u.id),
      fights_won = (SELECT count(*)::int FROM fights f WHERE f.winner_id = u.id),
      fights_lost = (SELECT count(*)::int FROM fights f WHERE (f.player1_id = u.id OR f.player2_id = u.id) AND f.winner_id IS NOT NULL AND f.winner_id <> u.id)
    `;
    const users = await connection<
      {
        id: string;
        aura: number;
        debt: number;
        debt_paid_count: number;
        aura_farm_count: number;
        messages_count: number;
        respect_count: number;
        fights_won: number;
        fights_lost: number;
        win_streak: number;
        loss_streak: number;
        warns_count: number;
        auto_banned_at: Date | null;
        is_clown: boolean;
        admin_glaze_mode: boolean;
        banned_until: Date | null;
        last_seen_at: Date | null;
      }[]
    >`
      SELECT id, aura, debt, aura_farm_count, messages_count, respect_count,
        fights_won, fights_lost, win_streak, loss_streak, warns_count,
        auto_banned_at, is_clown, admin_glaze_mode, debt_paid_count,
        banned_until, last_seen_at FROM users
    `;
    const roomStatuses = await connection<
      {
        creator_id: string;
        room_state: string;
      }[]
    >`SELECT creator_id, room_state FROM rooms WHERE room_state IN ('active', 'quarantined')`;
    const roomKeys = new Map<string, Set<string>>();
    for (const room of roomStatuses) {
      const keys = roomKeys.get(room.creator_id) ?? new Set<string>();
      keys.add(room.room_state === 'active' ? 'landlord' : 'ratio_d');
      roomKeys.set(room.creator_id, keys);
    }
    const fightRows = await connection<
      {
        player1_id: string;
        player2_id: string | null;
        winner_id: string | null;
        stake_amount: number;
        outcome: 'ko' | 'rage_quit' | 'cancelled';
        created_at: Date;
      }[]
    >`SELECT player1_id, player2_id, winner_id, stake_amount, outcome, created_at
      FROM fights ORDER BY created_at DESC`;
    const fightHistory = new Map<string, typeof fightRows>();
    for (const fight of fightRows) {
      for (const userId of [fight.player1_id, fight.player2_id]) {
        if (!userId) continue;
        const history = fightHistory.get(userId) ?? [];
        history.push(fight);
        fightHistory.set(userId, history);
      }
    }
    for (const user of users) {
      const keys = new Set<string>();
      const history = (fightHistory.get(user.id) ?? []).filter(
        (fight) => fight.outcome !== 'cancelled',
      );
      let streak: boolean | undefined;
      let currentStreak = 0;
      for (const fight of history) {
        const won = fight.winner_id === user.id;
        if (streak === undefined) streak = won;
        if (won !== streak) break;
        currentStreak += 1;
      }
      await connection`
        UPDATE users SET win_streak = ${streak ? currentStreak : 0},
          loss_streak = ${streak === false ? currentStreak : 0}
        WHERE id = ${user.id}
      `;
      if (user.aura_farm_count > 0) keys.add('first_farm');
      if (user.aura_farm_count >= 1000) keys.add('aura_farmer');
      if (user.aura >= 10000) keys.add('aura_god');
      if (user.aura < 0) keys.add('in_the_negatives');
      if (user.aura <= -1000) keys.add('bankrupt_vibes');
      if (user.debt > 0) keys.add('first_debt');
      if (user.debt < 0) keys.add('financial_cushion');
      if (user.debt <= -1000) keys.add('loan_shark');
      if (user.debt >= 1000) keys.add('debt_lord');
      if (user.debt_paid_count >= 100) keys.add('debt_free');
      if (user.fights_won > 0) keys.add('first_blood');
      if (user.fights_won + user.fights_lost >= 10)
        keys.add('basement_regular');
      if (streak && currentStreak >= 5) keys.add('undefeated');
      if (streak === false && currentStreak >= 10)
        keys.add('professionally_mogged');
      if (history.some((fight) => fight.stake_amount >= 500))
        keys.add('high_roller');
      if (
        history.some(
          (fight, index) =>
            index >= 2 &&
            history[index - 2].created_at.getTime() -
              fight.created_at.getTime() <=
              3600000,
        )
      ) {
        keys.add('the_soap_market');
      }
      if (
        history.some(
          (fight) =>
            fight.outcome === 'rage_quit' &&
            (fight.winner_id === fight.player1_id
              ? fight.player2_id === user.id
              : fight.player1_id === user.id),
        )
      ) {
        keys.add('rage_quitter');
      }
      if (user.messages_count >= 100) keys.add('yapper');
      if (user.messages_count >= 1000) keys.add('certified_yapper');
      if (user.respect_count >= 10) keys.add('respected');
      if (user.respect_count >= 100) keys.add('glazed');
      if (user.warns_count > 0) keys.add('first_warn');
      if (user.auto_banned_at) keys.add('cooked');
      if (user.is_clown) keys.add('clown_certified');
      if (user.admin_glaze_mode) keys.add('admins_favourite');
      if (
        user.banned_until &&
        user.last_seen_at &&
        user.last_seen_at > user.banned_until
      ) {
        keys.add('survivor');
      }
      for (const key of roomKeys.get(user.id) ?? []) keys.add(key);
      for (const key of keys) {
        const rows = await connection`
          INSERT INTO user_achievements (user_id, key)
          VALUES (${user.id}, ${key}) ON CONFLICT DO NOTHING RETURNING key
        `;
        granted += rows.length;
      }
    }
    console.log(`${users.length} users scanned; ${granted} medals granted`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
