// declare module 'speakeasy' {
//   export interface Secret {
//     ascii: string;
//     hex: string;
//     base32: string;
//     otpauth_url?: string;
//   }
//
//   export function generateSecret(options: { name: string }): Secret;
//
//   export namespace totp {
//     function verify(options: {
//       secret: string;
//       encoding: string;
//       token: string;
//       window?: number;
//     }): boolean;
//   }
// }
