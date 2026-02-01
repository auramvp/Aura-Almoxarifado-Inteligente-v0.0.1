import { supabase } from "../supabaseClient";

export async function sendReportEmail(
  to: string[],
  subject: string,
  html: string
) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, html },
  });

  if (error) {
    console.error("Erro ao enviar email:", error);
    throw error;
  }

  return data;
}
