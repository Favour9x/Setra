import nodemailer from "nodemailer";

interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}

const getEmailConfig = (): EmailConfig => {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || '"Setra Fintech" <invoices@setra.fintech>',
  };
};

/**
 * Sends a professionally-styled Setra invoice email to the recipient.
 */
export async function sendInvoiceEmail(
  invoice: { id: string; title: string; amount: number; due_date: string },
  senderName: string,
  recipientEmail: string
): Promise<{ success: boolean; status: "sent" | "mocked" | "failed"; error?: string }> {
  const config = getEmailConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payUrl = `${appUrl}/invoices/pay/${invoice.id}`;
  const formattedDueDate = new Date(invoice.due_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New USDC Invoice from ${senderName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0B0E11;
          color: #E2E8F0;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #141920;
          border: 1px solid #2A3444;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .header {
          background: linear-gradient(135deg, #0D9488 0%, #115E59 100%);
          padding: 32px;
          text-align: center;
          border-bottom: 1px solid #2A3444;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.025em;
          text-transform: uppercase;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .content {
          padding: 40px;
        }
        .invoice-card {
          background: #0B0E11;
          border: 1px solid #2A3444;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 32px;
        }
        .invoice-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0D9488;
          margin: 0 0 8px 0;
        }
        .invoice-subject {
          font-size: 20px;
          font-weight: 800;
          color: #FFFFFF;
          margin: 0 0 20px 0;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          border-top: 1px solid #2A3444;
          padding-top: 20px;
        }
        .grid-item {
          display: flex;
          flex-direction: column;
        }
        .label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748B;
          margin-bottom: 4px;
        }
        .value {
          font-size: 14px;
          font-weight: 600;
          color: #E2E8F0;
        }
        .amount-highlight {
          font-size: 24px;
          font-weight: 900;
          color: #10B981;
          margin-top: 4px;
        }
        .btn-container {
          text-align: center;
          margin-top: 32px;
        }
        .btn {
          display: inline-block;
          background-color: #0D9488;
          color: #FFFFFF;
          text-decoration: none;
          padding: 16px 36px;
          font-weight: 800;
          font-size: 14px;
          border-radius: 12px;
          letter-spacing: -0.01em;
          transition: background-color 0.2s ease;
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
        }
        .btn:hover {
          background-color: #0F766E;
        }
        .footer {
          padding: 24px 40px;
          background: #0B0E11;
          border-top: 1px solid #2A3444;
          text-align: center;
          font-size: 11px;
          color: #64748B;
        }
        .footer a {
          color: #0D9488;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Setra</h1>
          <p>Decentralized Invoice Delivery</p>
        </div>
        <div class="content">
          <div class="invoice-card">
            <p class="invoice-title">Invoice Received</p>
            <h2 class="invoice-subject">${invoice.title}</h2>
            
            <div class="grid">
              <div class="grid-item">
                <span class="label">Sender</span>
                <span class="value">${senderName}</span>
              </div>
              <div class="grid-item">
                <span class="label">Amount Due</span>
                <span class="value amount-highlight">${invoice.amount} USDC</span>
              </div>
              <div class="grid-item" style="grid-column: span 2; margin-top: 8px;">
                <span class="label">Due Date</span>
                <span class="value">${formattedDueDate}</span>
              </div>
            </div>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #94A3B8; margin: 0; text-align: center;">
            You have received a smart invoice on the Setra fintech network. Click the button below to review invoice specifics, enter your payment credentials, or complete the transfer directly on-chain.
          </p>
          
          <div class="btn-container">
            <a href="${payUrl}" class="btn">Pay Invoice</a>
          </div>
        </div>
        <div class="footer">
          <p>Sent via <a href="${appUrl}">Setra Fintech</a>. All rights reserved.</p>
          <p style="margin-top: 8px;">Automating decentralized financial operations securely.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check if SMTP is configured
  if (!config.user || !config.pass) {
    console.log("ℹ️ [EMAIL MOCK SERVICE]: SMTP credentials not found in .env.local.");
    console.log("------------------ MOCK EMAIL START ------------------");
    console.log(`To: ${recipientEmail}`);
    console.log(`Subject: New USDC Invoice from ${senderName}`);
    console.log(`Pay Link: ${payUrl}`);
    console.log("------------------- MOCK EMAIL END -------------------");
    return { success: true, status: "mocked" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.sendMail({
      from: config.from,
      to: recipientEmail,
      subject: `New USDC Invoice from ${senderName}`,
      html: htmlContent,
    });

    console.log(`✅ [EMAIL SERVICE]: Invoice email sent successfully to ${recipientEmail}`);
    return { success: true, status: "sent" };
  } catch (error: any) {
    console.error("❌ [EMAIL SERVICE] error sending email:", error);
    return { success: false, status: "failed", error: error.message };
  }
}

/**
 * Sends a professionally-styled transaction receipt email to a user.
 */
export async function sendTransactionReceiptEmail(
  recipientEmail: string,
  transaction: {
    type: "income" | "expense" | "payment_sent" | "payment_received";
    amount: number;
    currency: string;
    recipientOrSender: string;
    txHash?: string;
    category?: string;
  }
): Promise<{ success: boolean; status: "sent" | "mocked" | "failed"; error?: string }> {
  const config = getEmailConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const typeDisplay = (transaction.type === "expense" || transaction.type === "payment_sent") ? "Payment Sent" : "Payment Received";
  const amountColor = (transaction.type === "expense" || transaction.type === "payment_sent") ? "#EF4444" : "#10B981";
  const prefixSign = (transaction.type === "expense" || transaction.type === "payment_sent") ? "-" : "+";
  
  const explorerUrl = transaction.txHash 
    ? `https://blockscout.acala.network/tx/${transaction.txHash}`
    : null;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Setra Transaction Receipt</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #0B0E11;
          color: #E2E8F0;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #141920;
          border: 1px solid #2A3444;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .header {
          background: linear-gradient(135deg, #0D9488 0%, #115E59 100%);
          padding: 32px;
          text-align: center;
          border-bottom: 1px solid #2A3444;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.025em;
          text-transform: uppercase;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .content {
          padding: 40px;
        }
        .receipt-card {
          background: #0B0E11;
          border: 1px solid #2A3444;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 32px;
          text-align: center;
        }
        .receipt-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0D9488;
          margin: 0 0 8px 0;
        }
        .amount-display {
          font-size: 36px;
          font-weight: 900;
          color: ${amountColor};
          margin: 12px 0;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          border-top: 1px solid #2A3444;
          padding-top: 20px;
          text-align: left;
          margin-top: 20px;
        }
        .grid-item {
          display: flex;
          flex-direction: column;
        }
        .label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748B;
          margin-bottom: 4px;
        }
        .value {
          font-size: 13px;
          font-weight: 600;
          color: #E2E8F0;
          word-break: break-all;
        }
        .footer {
          padding: 24px 40px;
          background: #0B0E11;
          border-top: 1px solid #2A3444;
          text-align: center;
          font-size: 11px;
          color: #64748B;
        }
        .footer a {
          color: #0D9488;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Setra</h1>
          <p>Transaction Settlement Receipt</p>
        </div>
        <div class="content">
          <div class="receipt-card">
            <p class="receipt-title">${typeDisplay}</p>
            <h2 class="amount-display">${prefixSign}${transaction.amount} ${transaction.currency}</h2>
            
            <div class="grid">
              <div class="grid-item">
                <span class="label">${(transaction.type === "expense" || transaction.type === "payment_sent") ? "Recipient" : "Sender"}</span>
                <span class="value">${transaction.recipientOrSender}</span>
              </div>
              <div class="grid-item">
                <span class="label">Category</span>
                <span class="value">${transaction.category || "Transfer"}</span>
              </div>
              ${transaction.txHash ? `
                <div class="grid-item" style="grid-column: span 2; margin-top: 8px;">
                  <span class="label">Transaction Hash</span>
                  <span class="value font-mono" style="font-size: 11px;">${transaction.txHash}</span>
                </div>
              ` : ""}
            </div>
          </div>
          
          ${explorerUrl ? `
            <div style="text-align: center; margin-top: 24px;">
              <a href="${explorerUrl}" target="_blank" style="display: inline-block; background-color: #1E293B; color: #FFFFFF; text-decoration: none; padding: 12px 24px; font-weight: 700; font-size: 13px; border-radius: 8px; border: 1px solid #334155;">
                View on Block Explorer
              </a>
            </div>
          ` : ""}
        </div>
        <div class="footer">
          <p>Sent via <a href="${appUrl}">Setra Fintech</a>. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check if SMTP is configured
  if (!config.user || !config.pass) {
    console.log("ℹ️ SMTP credentials not found in .env.local.");
    console.log("------------------ MOCK RECEIPT EMAIL START ------------------");
    console.log(`To: ${recipientEmail}`);
    console.log(`Subject: Setra Transaction Receipt: ${typeDisplay}`);
    console.log(`Amount: ${prefixSign}${transaction.amount} ${transaction.currency}`);
    console.log("------------------- MOCK RECEIPT EMAIL END -------------------");
    return { success: true, status: "mocked" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.sendMail({
      from: config.from,
      to: recipientEmail,
      subject: `Setra Transaction Receipt: ${typeDisplay} of ${transaction.amount} ${transaction.currency}`,
      html: htmlContent,
    });

    console.log(`✅ [EMAIL SERVICE]: Transaction receipt email sent successfully to ${recipientEmail}`);
    return { success: true, status: "sent" };
  } catch (error: any) {
    console.error("❌ [EMAIL SERVICE] error sending transaction receipt:", error);
    return { success: false, status: "failed", error: error.message };
  }
}
