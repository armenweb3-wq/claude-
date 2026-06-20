import { NextResponse } from "next/server";

// Booking intake endpoint for Hustle Blends.
//
// This is a stub: it validates the shape and echoes a reference. Wire it to a
// real booking backend (Supabase table, Square/Acuity, an SMS confirmation via
// Twilio, etc.) before taking live reservations. The client never depends on
// the response, so the flow degrades gracefully if this endpoint is offline.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { service, date, time, name, phone } = body;
  if (!service || !date || !time || !name || !phone) {
    return NextResponse.json(
      { ok: false, error: "Missing required booking fields" },
      { status: 422 },
    );
  }

  // TODO: persist the booking and trigger a confirmation message.
  const reference =
    "HB-" + Date.now().toString(36).toUpperCase().slice(-6);

  return NextResponse.json({ ok: true, reference });
}
