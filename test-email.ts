import { readFileSync } from "fs";

// Load env from .dev.vars
const devVars = readFileSync(".dev.vars", "utf-8");
const env: Record<string, string> = {};
devVars.split("\n").forEach(line => {
  if (line && !line.startsWith("#")) {
    const [key, ...valueT] = line.split("=");
    const val = valueT.join("=").replace(/^"(.*)"$/, '$1');
    env[key.trim()] = val.trim();
  }
});

async function sendTestEmail() {
  const resendApiKey = env.RESEND_API_KEY;
  const senderEmail = env.EMAIL_SENDER;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
      <h2 style="color: #2563eb;">Test Pesan SAKU</h2>
      <p>Halo Dimzzy!</p>
      <p>Ini adalah pesan percobaan (TEST) dari integrasi Resend Email Service di proyek <b>SAKU Backend</b>.</p>
      <p>Jika kamu menerima email ini, berarti konfigurasi API Key dan Pengiriman Email sudah 100% berjalan dengan sangat baik!</p>
      <p><br>Best regards,<br><b>Abcd</b></p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderEmail,
        to: ["[EMAIL_ADDRESS]"],
        subject: "SAKU Backend - Email Test",
        html: html,
      }),
    });

    if (!response.ok) {
      const errortext = await response.text();
      console.error("Failed to send email:", errortext);
    } else {
      console.log("TEST EMAIL SENT SUCCESSFULLY TO target");
      const data = await response.json();
      console.log(data);
    }
  } catch (error) {
    console.error("Error sending email via Resend:", error);
  }
}

sendTestEmail();
