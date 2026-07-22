import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly resend: Resend;
  private readonly sender: string;

  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing');
    }

    if (!process.env.RESEND_SENDER) {
      throw new Error('RESEND_SENDER is missing');
    }

    if (!process.env.BACKEND_URL) {
      throw new Error('BACKEND_URL is missing');
    }

    // Initialize the Resend client
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.sender = process.env.RESEND_SENDER;
  }

  async sendVerificationEmail(to: string, token: string) {
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const verificationUrl = new URL('/auth/verify-email', frontendBaseUrl);
    verificationUrl.searchParams.set('token', token);

    const html = this.buildVerificationTemplate(verificationUrl.toString());
    const text = `Verify your email: ${verificationUrl.toString()}`;

    const { data, error } = await this.resend.emails.send({
      from: this.sender,
      to,
      subject: 'Verify Your Email - YS Cineplex',
      html,
      text,
    });

    if (error) {
      console.error('❌ Resend verification email error:', error);
      throw new Error(`Failed to send verification email: ${error.message}`);
    }

    return data;
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    const resetUrl = new URL('/auth/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', token);

    // console.log('Email Reset Link generated:', resetUrl.toString());

    const html = this.wrapEmail(
      'Reset Password',
      `
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:600;">
        Reset your password
      </h2>

      <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
        We received a request to reset your password.
      </p>

      <div style="text-align:center;margin:26px 0;">
        <a href="${resetUrl.toString()}" style="
          background:#111827;
          color:#fff;
          padding:12px 20px;
          text-decoration:none;
          border-radius:6px;
          display:inline-block;
        ">
          Reset Password
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;text-align:center;">
        This link expires in 5 minutes.
      </p>
      `,
    );

    const { data, error } = await this.resend.emails.send({
      from: this.sender,
      to,
      subject: 'Reset Password - YS Cineplex',
      html,
    });

    if (error) {
      console.error('❌ Resend reset password email error:', error);
      throw new Error(`Failed to send reset password email: ${error.message}`);
    }

    return data;
  }

  async sendReactivateAccountEmail(to: string, token: string) {
    const baseUrl = process.env.BACKEND_URL!;
    const reactivateUrl = new URL('/api/v1/auth/reactivate/confirm', baseUrl);
    reactivateUrl.searchParams.set('token', token);

    const html = this.wrapEmail(
      'Reactivate Account',
      `
      <h2 style="margin:0 0 10px;font-size:18px;font-weight:600;">
        Reactivate Account
      </h2>

      <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
        Your account has been marked as deleted.
        Click the button below to restore access.
      </p>

      <div style="text-align:center;margin:26px 0;">
        <a href="${reactivateUrl.toString()}" style="
          background:#111827;
          color:#fff;
          padding:12px 20px;
          text-decoration:none;
          border-radius:6px;
          display:inline-block;
        ">
          Reactivate Account
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;text-align:center;">
        This link expires in 30 minutes.
      </p>
    `,
    );

    const { data, error } = await this.resend.emails.send({
      from: this.sender,
      to,
      subject: 'Reactivate Your Account - YS Cineplex',
      html,
    });

    if (error) {
      console.error('❌ Resend reactivate account email error:', error);
      throw new Error(`Failed to send reactivation email: ${error.message}`);
    }

    return data;
  }

  async sendBookingConfirmationEmail(
    to: string,
    details: {
      firstName: string;
      bookingCode: string;
      movieTitle: string;
      theaterName: string;
      screenName: string;
      startTime: string;
      seats: string;
      totalPrice: number;
    },
  ) {
    const startDate = new Date(details.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = this.wrapEmail(
      'Booking Confirmed',
      `
        <h2 style="margin:0 0 10px;font-size:18px;font-weight:600;">
          Booking Confirmed!
        </h2>
        <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
          Hi ${details.firstName || 'there'},
        </p>
        <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
          Your booking <strong>${details.bookingCode}</strong> has been confirmed.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;">
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Movie</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${details.movieTitle}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Theater</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${details.theaterName} - ${details.screenName}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Date & Time</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${formattedDate} at ${formattedTime}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Seats</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${details.seats}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Total Paid</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">$${details.totalPrice.toFixed(2)}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#4b5563;text-align:center;">
          Please show your QR code at the entrance for entry.
        </p>
        <p style="font-size:12px;color:#6b7280;text-align:center;">
          Thank you for choosing YS Cineplex!
        </p>
        `,
    );

    const { data, error } = await this.resend.emails.send({
      from: this.sender,
      to,
      subject: 'Booking Confirmed - YS Cineplex',
      html,
    });

    if (error) {
      console.error('❌ Resend booking confirmation email error:', error);
      throw new Error(`Failed to send booking confirmation: ${error.message}`);
    }

    return data;
  }

  private buildVerificationTemplate(url: string) {
    return this.wrapEmail(
      'Verify Email',
      `
        <h2 style="
          margin:0 0 10px;
          font-size:18px;
          font-weight:600;
          color:#111827;
        ">
          Verify your email address
        </h2>

        <p style="
          margin:0 0 18px;
          font-size:14px;
          color:#4b5563;
          line-height:1.6;
        ">
          Thank you for registering with YS Cineplex.
          To continue, please verify your email address. This helps us secure your account and enable access to the platform.
        </p>

        <div style="
          margin:26px 0;
          text-align:center;
        ">
          <a href="${url}" style="
            display:inline-block;
            background:#111827;
            color:#ffffff;
            text-decoration:none;
            padding:12px 20px;
            border-radius:6px;
            font-size:14px;
            font-weight:500;
          ">
            Verify Email
          </a>
        </div>

        <p style="
          font-size:12px;
          color:#6b7280;
          text-align:center;
          margin-top:8px;
        ">
          This link will expire in 5 minutes for security reasons.
        </p>
        `,
    );
  }

  private wrapEmail(title: string, content: string) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f4f6;
  font-family:Arial, Helvetica, sans-serif;
  color:#111827;
">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 12px;">
    <tr>
      <td align="center">

        <!-- CONTAINER -->
        <table width="100%" cellpadding="0" cellspacing="0" style="
          max-width:560px;
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:10px;
          overflow:hidden;
        ">

          <!-- HEADER -->
          <tr>
            <td style="
              padding:22px 26px;
              border-bottom:1px solid #e5e7eb;
              text-align:center;
              background:#ffffff;
            ">
              <h1 style="
                margin:0;
                font-size:16px;
                font-weight:600;
                color:#111827;
                letter-spacing:0.3px;
              ">
                YS Cineplex
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="
              padding:30px 26px;
              font-size:14px;
              line-height:1.6;
              color:#111827;
            ">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              padding:16px 26px;
              border-top:1px solid #e5e7eb;
              font-size:12px;
              color:#6b7280;
              text-align:center;
              background:#fafafa;
            ">
              © ${new Date().getFullYear()} YS Cineplex. All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
  }
}
