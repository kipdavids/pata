import { NextResponse } from "next/server";
import { errorMessage, friendlyRpcError } from "@/lib/server/errors";
import { getAdminClient, getRequestUser } from "@/lib/server/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const { code } = await params;
    const body = await request.json().catch(() => ({}));
    const number = Number((body as { number?: unknown }).number);
    if (!Number.isInteger(number) || number < 1 || number > 100) {
      return NextResponse.json(
        { error: "Pick a number from 1 to 100." },
        { status: 400 },
      );
    }

    const admin = getAdminClient();
    const { data: match, error: matchError } = await admin
      .from("matches")
      .select("id")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const { data, error } = await admin.rpc("select_number", {
      p_match_id: match.id,
      p_player: user.id,
      p_number: number,
    });

    if (error) {
      return NextResponse.json(
        { error: friendlyRpcError(error.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({
      match: data,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    console.error("select number failed", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
