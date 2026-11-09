import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/server/errors";
import { getAdminClient, getRequestUser } from "@/lib/server/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const { code } = await params;
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("matches")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const { data: lastTurn, error: turnError } = await admin
      .from("turns")
      .select("*")
      .eq("match_id", data.id)
      .not("elapsed_us", "is", null)
      .order("turn_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (turnError) throw turnError;

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, avatar_url")
      .in("id", [data.player1, data.player2].filter(Boolean) as string[]);

    const avatarMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.avatar_url]),
    );

    return NextResponse.json({
      match: data,
      lastTurn,
      serverNow: new Date().toISOString(),
      player1Avatar: avatarMap.get(data.player1) ?? null,
      player2Avatar: data.player2
        ? (avatarMap.get(data.player2) ?? null)
        : null,
    });
  } catch (error) {
    console.error("load match failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
