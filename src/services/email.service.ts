export class EmailService {
  constructor(private resendApiKey: string) {}

  async sendVerificationEmail(
    to: string,
    verificationUrl: string
  ): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verifikasi Email SAKU</h2>
        <p>Halo,</p>
        <p>Terima kasih telah mendaftar di SAKU. Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verifikasi Email Saya
        </a>
        <p>Jika Anda tidak merasa mendaftar di SAKU, abaikan email ini.</p>
        <p><br>Salam,<br>Tim SAKU</p>
      </div>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SAKU <onboarding@resend.dev>",
          to: [to],
          subject: "Verifikasi Pendaftaran SAKU",
          html: html,
        }),
      });

      if (!response.ok) {
        const errortext = await response.text();
        console.error("Failed to send email:", errortext);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending email via Resend:", error);
      return false;
    }
  }
}
