import { NextResponse } from "next/server";
import { errorMessage, friendlyRpcError } from "@/lib/server/errors";
import { displayNameFrom } from "@/lib/server/names";
import { getAdminClient, getRequestUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const code = String((body as { code?: unknown }).code ?? "")
      .trim()
      .toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Enter a match code." }, { status: 400 });
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

    const { data, error } = await admin.rpc("join_match", {
      p_code: code,
      p_player: user.id,
      p_name: displayName,
    });

    if (error) {
      return NextResponse.json(
        { error: friendlyRpcError(error.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    console.error("join match failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
