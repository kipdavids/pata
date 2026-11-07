import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/server/errors";
import { displayNameFrom } from "@/lib/server/names";
import { newMatchCode, shuffledBoard } from "@/lib/server/random";
import { getAdminClient, getRequestUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const turns = Number((body as { turnsPerPlayer?: unknown }).turnsPerPlayer);
    if (turns !== 5 && turns !== 10 && turns !== 20) {
      return NextResponse.json(
        { error: "Turns per player must be 5, 10 or 20." },
        { status: 400 },
      );
    }

    const displayName = displayNameFrom(
      (body as { displayName?: unknown }).displayName,
      user.id,
    );
    const admin = getAdminClient();

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data, error } = await admin
        .from("matches")
        .insert({
          code: newMatchCode(),
          status: "waiting",
          turns_per_player: turns,
          total_turns: turns * 2,
          board: shuffledBoard(),
          player1: user.id,
          player1_name: displayName,
        })
        .select("*")
        .single();

      if (!error) {
        return NextResponse.json({ match: data });
      }

      lastError = error;
      if ((error as { code?: string }).code !== "23505") break;
    }

    throw lastError ?? new Error("Could not create a unique match code.");
  } catch (error) {
    console.error("create match failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
