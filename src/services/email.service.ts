export class EmailService {
  constructor(private resendApiKey: string, private senderEmail: string) {}

  async sendVerificationEmail(
    to: string,
    verificationUrl: string
  ): Promise<boolean> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>SAKU Email Verification</h2>
        <p>Hello,</p>
        <p>Thank you for registering at SAKU. Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify My Email
        </a>
        <p>If you did not register for SAKU, please ignore this email.</p>
        <p><br>Best regards,<br>The SAKU Team</p>
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
          from: this.senderEmail,
          to: [to],
          subject: "SAKU Registration Verification",
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
