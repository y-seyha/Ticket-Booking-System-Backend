import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MailerService {
  private readonly endpoint =
    process.env.BREVO_EMAIL_ENDPOINT || 'https://api.brevo.com/v3/smtp/email';

  private readonly sender = {
    name: 'YS Cineplex',
    email: process.env.BREVO_SENDER!,
  };

  private readonly headers = {
    accept: 'application/json',
    'api-key': process.env.BREVO_API_KEY!,
    'content-type': 'application/json',
  };

  constructor() {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is missing');
    }

    if (!process.env.BREVO_SENDER) {
      throw new Error('BREVO_SENDER is missing');
    }

    if (!process.env.BACKEND_URL) {
      throw new Error('BACKEND_URL is missing');
    }
  }

  // async sendVerificationEmail(to: string, token: string) {
  //   // const backendUrl = new URL(process.env.BACKEND_URL!);
  //
  //   // const verificationUrl = new URL(
  //   //     '/verify-email',
  //   //     process.env.FRONTEND_URL,
  //   // );
  //
  //   const baseUrl = process.env.BACKEND_URL;
  //
  //   if (!baseUrl) {
  //     throw new Error('BACKEND_URL is missing');
  //   }
  //
  //   const verificationUrl = new URL('/api/v1/auth/verify-email', baseUrl);
  //   verificationUrl.searchParams.set('token', token);
  //
  //   const html = this.buildVerificationTemplate(verificationUrl.toString());
  //
  //   const text = `Verify your email: ${verificationUrl.toString()}`;
  //
  //   const res = await axios.post(
  //     this.endpoint,
  //     {
  //       sender: this.sender,
  //
  //       to: [
  //         {
  //           email: to,
  //         },
  //       ],
  //
  //       subject: 'Verify Your Email - Coffee POS System',
  //
  //       htmlContent: html,
  //
  //       textContent: text,
  //     },
  //     {
  //       headers: this.headers,
  //       timeout: 10000,
  //     },
  //   );
  //
  //   console.log('📧 Brevo verification email response:', res.data);
  //
  //   return res.data;
  // }

  // Inside MailerService (NestJS)
  async sendVerificationEmail(to: string, token: string) {
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const verificationUrl = new URL('/auth/verify-email', frontendBaseUrl);
    verificationUrl.searchParams.set('token', token);

    const html = this.buildVerificationTemplate(verificationUrl.toString());
    const text = `Verify your email: ${verificationUrl.toString()}`;

    const res = await axios.post(
      this.endpoint,
      {
        sender: this.sender,
        to: [{ email: to }],
        subject: 'Verify Your Email - Coffee POS System',
        htmlContent: html,
        textContent: text,
      },
      { headers: this.headers, timeout: 10000 },
    );

    console.log('📧 Brevo verification email response:', res.data);
    return res.data;
  }

  // async sendResetPasswordEmail(to: string, token: string) {
  //   const baseUrl = process.env.BACKEND_URL!;
  //
  //   const resetUrl = new URL('/api/v1/auth/reset-password', baseUrl);
  //   resetUrl.searchParams.set('token', token);
  //
  //   console.log(resetUrl.toString());
  //
  //   const html = this.wrapEmail(
  //     'Reset Password',
  //     `
  //       <h2 style="margin:0 0 10px;font-size:18px;font-weight:600;">
  //         Reset your password
  //       </h2>
  //
  //       <p style="margin:0 0 18px;font-size:14px;color:#4b5563;">
  //         We received a request to reset your password.
  //       </p>
  //
  //       <div style="text-align:center;margin:26px 0;">
  //         <a href="${resetUrl}" style="
  //           background:#111827;
  //           color:#fff;
  //           padding:12px 20px;
  //           text-decoration:none;
  //           border-radius:6px;
  //         ">
  //           Reset Password
  //         </a>
  //       </div>
  //
  //       <p style="font-size:12px;color:#6b7280;text-align:center;">
  //         This link expires in 5 minutes.
  //       </p>
  //       `,
  //   );
  //
  //   await axios.post(
  //     this.endpoint,
  //     {
  //       sender: this.sender,
  //       to: [{ email: to }],
  //       subject: 'Reset Password',
  //       htmlContent: html,
  //     },
  //     { headers: this.headers },
  //   );
  // }

  async sendResetPasswordEmail(to: string, token: string) {
    // 1. Change this to use your FRONTEND client application URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // 2. Point to your Next.js frontend route (e.g., /auth/reset-password)
    const resetUrl = new URL('/auth/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', token);

    console.log('Email Reset Link generated:', resetUrl.toString());

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

    await axios.post(
      this.endpoint,
      {
        sender: this.sender,
        to: [{ email: to }],
        subject: 'Reset Password',
        htmlContent: html,
      },
      { headers: this.headers },
    );
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
        <a href="${reactivateUrl}" style="
          background:#111827;
          color:#fff;
          padding:12px 20px;
          text-decoration:none;
          border-radius:6px;
        ">
          Reactivate Account
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;text-align:center;">
        This link expires in 30 minutes.
      </p>
    `,
    );

    await axios.post(
      this.endpoint,
      {
        sender: this.sender,
        to: [{ email: to }],
        subject: 'Reactivate Your Account',
        htmlContent: html,
      },
      {
        headers: this.headers,
      },
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
}
