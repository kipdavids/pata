import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/server/errors";
import { getAdminClient } from "@/lib/server/supabase";

export async function GET() {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("leaderboard")
      .select("*")
      .order("wins", { ascending: false })
      .order("total_points", { ascending: false })
      .limit(50);

    if (error) throw error;

    const { data: recent, error: recentError } = await admin
      .from("matches")
      .select(
        "id, code, player1, player2, player1_name, player2_name, player1_score, player2_score, winner, finished_at",
      )
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(12);

    if (recentError) throw recentError;

    return NextResponse.json({
      leaderboard: data ?? [],
      recent: recent ?? [],
    });
  } catch (error) {
    console.error("leaderboard failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
