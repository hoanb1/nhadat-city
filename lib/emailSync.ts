import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { sql } from './db/pg';

function extractImapCredentials() {
  const mailUrl = process.env.MAIL_URL;
  if (!mailUrl) return null;
  // smtps://user:pass@host:port
  try {
    const url = new URL(mailUrl);
    return {
      user: decodeURIComponent(url.username),
      pass: decodeURIComponent(url.password),
      host: 'imap.larksuite.com', // Override host to IMAP instead of SMTP
      port: 993,
      secure: true
    };
  } catch (e) {
    console.error("Failed to parse MAIL_URL", e);
    return null;
  }
}

export async function syncEmailsForFolder(client: ImapFlow, folderName: string, dbFolderName: 'inbox' | 'sent') {
  await client.mailboxOpen(folderName);
  
  // Find the highest UID we have in this folder
  const latestMail = await sql`SELECT uid FROM emails WHERE folder = ${dbFolderName} ORDER BY uid DESC LIMIT 1`;

  const lastUid = latestMail.length > 0 ? Number(latestMail[0].uid) : 0;
  
  // Fetch messages newer than our last UID
  const fetchRange = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';
  
  console.log(`Syncing folder ${folderName} from UID ${fetchRange}`);
  
  let count = 0;
  try {
    // We use uid flag
    for await (let message of client.fetch(fetchRange, { source: true, envelope: true }, { uid: true })) {
      if (!message.source) continue;
      const parsed = await simpleParser(message.source as Buffer);
      
      const emailDoc = {
        uid: message.uid,
        messageId: parsed.messageId,
        folder: dbFolderName,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.value || [],
        to: Array.isArray(parsed.to) ? parsed.to.flatMap(t => t.value) : parsed.to?.value || [],
        date: parsed.date || new Date(),
        text: parsed.text || '',
        html: parsed.html || parsed.textAsHtml || '',
        syncedAt: new Date()
      };
      
      await sql`
        INSERT INTO emails (folder, uid, message_id, subject, from_addrs, to_addrs, date, text, html, synced_at)
        VALUES (${dbFolderName}, ${emailDoc.uid}, ${emailDoc.messageId ?? null}, ${emailDoc.subject},
                ${sql.json(emailDoc.from as any)}, ${sql.json(emailDoc.to as any)}, ${emailDoc.date},
                ${emailDoc.text}, ${typeof emailDoc.html === 'string' ? emailDoc.html : ''}, ${emailDoc.syncedAt})
        ON CONFLICT (folder, uid) DO UPDATE SET
          message_id = EXCLUDED.message_id, subject = EXCLUDED.subject, from_addrs = EXCLUDED.from_addrs,
          to_addrs = EXCLUDED.to_addrs, date = EXCLUDED.date, text = EXCLUDED.text, html = EXCLUDED.html,
          synced_at = EXCLUDED.synced_at`;
      count++;
    }
  } catch (e: any) {
    // If range is out of bounds, ImapFlow might throw. We can ignore it if no new messages.
    if (!e.message?.includes('Nothing to fetch')) {
      console.error(`Error fetching emails for ${folderName}:`, e);
    }
  }
  
  return count;
}

export async function syncAllEmails() {
  const creds = extractImapCredentials();
  if (!creds) throw new Error("Missing IMAP credentials");

  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: {
      user: creds.user,
      pass: creds.pass
    },
    logger: false as any
  });

  await client.connect();
  
  let syncedInbox = 0;
  let syncedSent = 0;
  try {
    // Standard Inbox
    syncedInbox = await syncEmailsForFolder(client, 'INBOX', 'inbox');
    
    // Attempt to find Sent folder. Larksuite uses "Sent Messages" or "Sent" or "\Sent"
    // Let's just list mailboxes to find it
    const mailboxes = await client.list();
    let sentFolder = 'Sent Messages'; // Default guess
    for (const mb of mailboxes) {
      if (mb.path.toLowerCase().includes('sent') || (mb.specialUse && mb.specialUse.includes('\\Sent'))) {
        sentFolder = mb.path;
        break;
      }
    }
    
    syncedSent = await syncEmailsForFolder(client, sentFolder, 'sent');
  } finally {
    await client.logout();
  }
  
  return { inbox: syncedInbox, sent: syncedSent };
}
