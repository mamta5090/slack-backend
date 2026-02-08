import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();


const transporter = nodemailer.createTransport({
  service: "Gmail",
  //port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,     
    pass: process.env.EMAIL_PASS, 
  },
});


transporter
  .verify()
  .then(() => console.log("Mail transporter ready"))
  .catch((err) =>
    console.error("Mail transporter verification failed:", err)
  );


async function sendInviteEmail({ to, workspace, customMessage = "" }) {
  const baseUrl = process.env.FRONTEND_URL;     
  const inviterName = process.env.INVITER_NAME;

 
  const inviteLink = `${baseUrl}/invite?workspace=${encodeURIComponent(workspace)}`;

  const subject = `${inviterName} has invited you to join ${workspace}`;

  const html = `
  <div style="font-family: Arial, sans-serif; background:#f4ede4; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.1)">
      
      <!-- Header -->
      <div style="padding:20px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px;">
        <img src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png" 
             alt="Slack Logo" width="32"/>
        <span style="font-size:18px; font-weight:bold; color:#1d1d1d;">Slack</span>
      </div>

      <!-- Body -->
      <div style="padding:30px; text-align:center;">
        <h2 style="color:#1d1d1d; margin-bottom:20px;">
          ${inviterName} has invited you to join <strong>${workspace}</strong>
        </h2>
        
        <p style="color:#555; font-size:15px; margin-bottom:30px;">
          ${customMessage || `Join the conversation with ${inviterName} and others in ${workspace}.`}
        </p>

        <!-- Join Button -->
        <a href="${inviteLink}" 
           style="display:inline-block; background:#611f69; color:#fff; 
                  padding:12px 24px; border-radius:6px; font-size:16px; 
                  text-decoration:none; font-weight:bold;">
          Join ${workspace}
        </a>

        <p style="color:#777; font-size:13px; margin-top:20px;">
          This invitation expires in 30 days. Once you join, you can always access your team’s workspace, <strong>${workspace}</strong>, at 
          <a href="${inviteLink}" style="color:#1264a3; text-decoration:none;">${inviteLink}</a>.
        </p>
      </div>
    </div>
  </div>
  `;

  const info = await transporter.sendMail({
    from: `"${inviterName}" <${process.env.EMAIL}>`,
    to,
    subject,
    html,
  });

  return info;
}

export default sendInviteEmail;
