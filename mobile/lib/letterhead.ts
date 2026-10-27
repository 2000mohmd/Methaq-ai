import type { Letterhead } from "./docx-export";
import { supabase } from "./supabase";

/** The signed-in user's saved letterhead (Settings), if any. */
export async function loadLetterhead(): Promise<Letterhead> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return {};
  const { data } = await supabase.from("profiles").select("letterhead").eq("id", u.user.id).single();
  return (data?.letterhead as Letterhead | null) ?? {};
}
