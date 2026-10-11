import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the link of the confirmation email lands (Supabase has already confirmed the address by then).
 * On the browser that created the account the code becomes a session and the user goes straight in;
 * anywhere else (the email opened on another device) there is no session to create, so the login page says
 * the email is confirmed and asks for the password.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  // an expired or already used link comes with an error and no code
  const failed = searchParams.has("error") || searchParams.has("error_description");
  return NextResponse.redirect(`${origin}/login?${failed ? "link=invalid" : "confirmed=1"}`);
}
