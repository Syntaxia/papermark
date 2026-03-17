import { JSXElementConstructor, ReactElement } from "react";

import { render, toPlainText } from "@react-email/render";
import nodemailer from "nodemailer";

import { log, nanoid } from "@/lib/utils";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Kept for backward compatibility with callers that check `resend` truthiness
export const resend = process.env.SMTP_HOST ? true : null;

export const sendEmail = async ({
  to,
  subject,
  react,
  from,
  marketing,
  system,
  verify,
  test,
  cc,
  replyTo,
  scheduledAt,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  react: ReactElement<any, string | JSXElementConstructor<any>>;
  from?: string;
  marketing?: boolean;
  system?: boolean;
  verify?: boolean;
  test?: boolean;
  cc?: string | string[];
  replyTo?: string;
  scheduledAt?: string;
  unsubscribeUrl?: string;
}) => {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP not configured — set SMTP_HOST in environment");
  }

  const html = await render(react);
  const plainText = toPlainText(html);

  const defaultFrom = process.env.SMTP_FROM_ADDRESS || "noreply@example.com";
  const fromAddress = from ?? defaultFrom;

  try {
    const headers: Record<string, string> = {
      "X-Entity-Ref-ID": nanoid(),
    };

    if (unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: test ? process.env.SMTP_TEST_ADDRESS || to : to,
      cc,
      replyTo,
      subject,
      html,
      text: plainText,
      headers,
    });

    return { id: info.messageId };
  } catch (exception) {
    log({
      message: `Unexpected error when sending email: ${exception}`,
      type: "error",
      mention: true,
    });
    throw exception;
  }
};

// No-op: Resend contact management is not available with SMTP
export const subscribe = async (_email: string): Promise<void> => {};
export const unsubscribe = async (_email: string): Promise<void> => {};
