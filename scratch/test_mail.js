const nodemailer = require('nodemailer');

async function sendTestEmail() {
  console.log('📧 Initializing test email dispatch to innovaft.co@gmail.com...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'rohitsiwachs1999@gmail.com',
      pass: 'dxiihpapzoelutvh', // Your new secure App Password
    },
  });

  const mailOptions = {
    from: '"Innovaft Automation Alerts" <innovaft.alerts@gmail.com>',
    to: 'innovaft.co@gmail.com',
    subject: '🔔 TEST: Innovaft Blog Automation Email Delivery Check',
    text: `Hello Team,

This is a test notification confirming that the Innovaft Blog Automation system is now successfully integrated with real-time email delivery.

Even without SMTP variables configured in your .env, all critical system alerts will successfully land in your inbox.

Status: Active & Operating ✅

Best regards,
Innovaft Automation Engine`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #c3e6cb; border-radius: 4px; padding: 20px; background-color: #d4edda; color: #155724;">
        <h2 style="margin-top: 0; color: #155724; border-bottom: 2px solid #c3e6cb; padding-bottom: 10px;">✅ Delivery Verification Successful</h2>
        <p><strong>Congratulations!</strong> Your blog automation notification system is fully operational.</p>
        <p>Even without custom SMTP settings in your environment variables, critical failure alerts are guaranteed to reach this inbox.</p>
        
        <div style="background: #ffffff; padding: 15px; border-radius: 4px; color: #333333; margin: 15px 0; border: 1px solid #ddd; font-size: 14px;">
          <strong>Notification Target:</strong> <code>innovaft.co@gmail.com</code><br>
          <strong>Status:</strong> Active & Ready 🟢
        </div>
        
        <p style="font-size: 12px; color: #6c757d; margin-top: 20px; text-align: center;">
          This is a verification test from Innovaft AI Engine.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Success! Test email dispatched successfully.');
    console.log('Message ID:', info.messageId);
    console.log('Envelope:', info.envelope);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
  }
}

sendTestEmail();
