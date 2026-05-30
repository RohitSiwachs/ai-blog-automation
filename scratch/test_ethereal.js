const nodemailer = require('nodemailer');

async function sendEtherealTest() {
  console.log('📧 Creating dynamic Ethereal test SMTP account...');
  
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Ethereal account created successfully!');
    console.log('SMTP Host:', testAccount.smtp.host);
    console.log('SMTP User:', testAccount.user);
    
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const mailOptions = {
      from: '"Innovaft Automation Alerts" <noreply@innovaft.com>',
      to: 'innovaft.co@gmail.com',
      subject: '🔔 TEST: Innovaft Blog Automation Email Delivery Check',
      text: 'This is a test notification confirming that the Innovaft Blog Automation system is now successfully integrated with real-time email delivery.',
      html: '<h3>Verification Successful</h3><p>Your blog automation notification system is fully operational.</p>',
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Success! Test email dispatched to Ethereal.');
    console.log('Message ID:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('❌ Failed to send Ethereal email:', error.message);
  }
}

sendEtherealTest();
