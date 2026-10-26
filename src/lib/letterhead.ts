import { supabase } from "@/integrations/supabase/client";
import type { Letterhead } from "./docx-export";

/** The signed-in user's saved letterhead (Settings), if any. */
export async function loadLetterhead(): Promise<Letterhead> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("profiles").select("letterhead").eq("id", u.user.id).single();
  return (data?.letterhead as Letterhead | null) ?? {};
}
