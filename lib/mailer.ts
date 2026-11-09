import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, html: string) => {
  const mailUrl = process.env.MAIL_URL;
  if (!mailUrl) {
    console.error('MAIL_URL is not set');
    return false;
  }

  // smtps://user:pass@host:port
  try {
    const url = new URL(mailUrl);
    const transporter = nodemailer.createTransport({
      host: url.hostname,
      port: parseInt(url.port || '465'),
      secure: url.protocol === 'smtps:',
      auth: {
        user: decodeURIComponent(url.username),
        pass: decodeURIComponent(url.password),
      },
    });

    const info = await transporter.sendMail({
      from: `"NhaDat.City" <${decodeURIComponent(url.username)}>`,
      to,
      subject,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
