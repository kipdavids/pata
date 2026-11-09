import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/server/errors";
import { getAdminClient, getRequestUser } from "@/lib/server/supabase";

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // First touch: create a profile row from the user's metadata.
      const name =
        (user.user_metadata?.display_name as string | undefined) ??
        `Player ${user.id.slice(0, 6)}`;
      const { data: created, error: createError } = await admin
        .from("profiles")
        .upsert(
          { id: user.id, display_name: name, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        )
        .select("id, display_name, avatar_url, created_at, updated_at")
        .single();
      if (createError) throw createError;
      return NextResponse.json({ profile: created });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("load profile failed", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      displayName?: unknown;
      avatarUrl?: unknown;
    };

    const admin = getAdminClient();

    const update: Record<string, unknown> = {
      id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.displayName === "string") {
      const clean = body.displayName.trim().slice(0, 24);
      if (clean.length >= 2) update.display_name = clean;
    }

    if (typeof body.avatarUrl === "string" || body.avatarUrl === null) {
      update.avatar_url = body.avatarUrl;
    }

    const { data, error } = await admin
      .from("profiles")
      .upsert(update, { onConflict: "id" })
      .select("id, display_name, avatar_url, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("update profile failed", error);
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}
