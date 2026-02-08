import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Mail transporter error:", error);
  } else {
    console.log("Mail transporter ready");
  }
});

export const sendOtpEmail = async ({ to, otp }) => {
  const mailOptions = {
    from: `"${process.env.INVITER_NAME}" <${process.env.EMAIL}>`,
    to,
    subject: "Confirm your email address",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #000;">
        <div style="text-align: center;">
          <img src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png" 
               alt="Slack" width="40" height="40" />
          <h2 style="font-size: 24px; margin: 20px 0;">Confirm your email address</h2>
          <p style="font-size: 16px; color: #444;">
            Your confirmation code is below – enter it in the browser window where you started signing up.
          </p>
          <div style="margin: 20px auto; padding: 15px; background: #f4f4f4; 
                      font-size: 28px; font-weight: bold; border-radius: 6px; 
                      display: inline-block; letter-spacing: 3px;">
            ${otp}
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #555;">
            If you haven’t requested this email, you can safely ignore it.
          </p>
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};
