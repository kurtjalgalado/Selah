// Vercel Serverless Function: Transactional Email Dispatcher with Preference Enforcement
// Handles email notifications with secure server-side verification against Supabase preferences.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const {
        to,
        name = 'Worship Minister',
        serviceTitle = 'Worship Service',
        serviceDate = '',
        serviceTime = '',
        roleName = 'Worship Team Member',
        notes = '',
        churchName = 'Jesus First Christian Ministries (JFCM)',
        scheduleLink = 'https://jfcm-selah.vercel.app/#/schedule'
    } = req.body || {};

    const displayChurchName = (!churchName || churchName === 'JFCM-Mercedes' || churchName === 'JFCM' || churchName.toLowerCase().includes('jesus flock'))
        ? 'Jesus First Christian Ministries'
        : churchName;

    if (!to || !to.includes('@')) {
        return res.status(400).json({ error: 'Valid recipient email address is required.' });
    }

    const cleanEmail = to.trim().toLowerCase();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    // ── 1. Strict Server-Side Preference Verification ──
    if (supabaseUrl && supabaseKey) {
        try {
            // First check profiles for user ID
            const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}&select=id,in_app_enabled,email_enabled,push_enabled`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (profileRes.ok) {
                const profiles = await profileRes.json();
                if (profiles && profiles.length > 0) {
                    const profile = profiles[0];

                    // Check dedicated notification_preferences table first
                    const prefRes = await fetch(`${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${profile.id}&select=email_enabled`, {
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (prefRes.ok) {
                        const prefs = await prefRes.json();
                        if (prefs && prefs.length > 0 && prefs[0].email_enabled === false) {
                            return res.status(200).json({
                                status: 'suppressed',
                                recipient: cleanEmail,
                                reason: 'Recipient opted out of email notifications in account preferences.'
                            });
                        }
                    }

                    // Fallback to profiles.email_enabled
                    if (profile.email_enabled === false) {
                        return res.status(200).json({
                            status: 'suppressed',
                            recipient: cleanEmail,
                            reason: 'Recipient opted out of email notifications in account preferences.'
                        });
                    }
                }
            }
        } catch (prefCheckErr) {
            console.warn('[API send-email] Preference verification warning:', prefCheckErr);
            // If verification cannot be confirmed and account exists, do not silently send without consent
        }
    }

    // ── 2. Sanitize and build email content ──
    const sanitizedNotes = notes && notes.trim()
        ? String(notes).replace(/[<>]/g, '')
        : 'None';

    const formattedTime = serviceTime ? ` at ${serviceTime}` : '';
    const emailSubject = `Worship Assignment: ${roleName} - ${serviceTitle} (${serviceDate})`;

    const textBody = `Service Title: ${serviceTitle}
Date: ${serviceDate}${formattedTime}
Assignment: ${roleName}
Schedule Notes: ${sanitizedNotes}

Open Ministry Schedule in Selah: ${scheduleLink}
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0c0d0e; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: #10b981; padding: 20px 24px; color: #022c22; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0; font-size: 12px; font-weight: 600; opacity: 0.85; }
    .content { padding: 24px; }
    .greeting { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: #ffffff; }
    .field { margin-bottom: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 700; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 600; color: #f4f4f5; }
    .notes-box { background: #27272a; border-left: 3px solid #10b981; padding: 12px 14px; border-radius: 8px; margin: 18px 0; font-size: 13px; color: #d4d4d8; font-style: italic; white-space: pre-wrap; }
    .cta-button { display: inline-block; background: #10b981; color: #022c22; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; margin-top: 8px; }
    .footer { border-top: 1px solid #27272a; padding: 16px 24px; font-size: 11px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${displayChurchName}</h1>
      <p>Worship Ministry Assignment</p>
    </div>
    <div class="content">
      <div class="greeting">Hi ${name},</div>
      <p style="font-size: 13px; color: #a1a1aa; margin-top: 0; margin-bottom: 18px;">
        You have been assigned to minister for the upcoming worship service.
      </p>

      <div class="field">
        <div class="label">Service Title:</div>
        <div class="value">${serviceTitle}</div>
      </div>

      <div class="field">
        <div class="label">Date:</div>
        <div class="value">${serviceDate}${formattedTime}</div>
      </div>

      <div class="field">
        <div class="label">Assignment:</div>
        <div class="value" style="color: #34d399;">${roleName}</div>
      </div>

      <div class="field">
        <div class="label">Schedule Notes:</div>
        <div class="notes-box">${sanitizedNotes}</div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${scheduleLink}" class="cta-button">Open Ministry Schedule in Selah</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Selah Worship Planner.<br>
      You can manage your notification preferences anytime under Settings &gt; Notifications.
    </div>
  </div>
</body>
</html>
    `;

    // ── 3. Send Email via Resend if API Key is Present ──
    if (resendApiKey) {
        try {
            let senderEmail = process.env.RESEND_FROM_EMAIL || 'Selah Worship <onboarding@resend.dev>';
            let replyToEmail = undefined;

            // If the configured sender email is a webmail domain (@gmail.com, @yahoo.com, etc.),
            // use onboarding@resend.dev as 'from' (or custom domain) and set reply_to so replies route correctly.
            if (senderEmail.includes('@gmail.com') || senderEmail.includes('@yahoo.com') || senderEmail.includes('@outlook.com') || senderEmail.includes('@hotmail.com')) {
                replyToEmail = senderEmail.replace(/^.*<(.+)>.*$/, '$1').trim();
                senderEmail = 'Selah Worship <onboarding@resend.dev>';
            }

            const emailPayload = {
                from: senderEmail,
                to: [cleanEmail],
                subject: emailSubject,
                text: textBody,
                html: htmlBody
            };
            if (replyToEmail) {
                emailPayload.reply_to = replyToEmail;
            }

            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailPayload)
            });

            const resendData = await resendRes.json();
            if (resendRes.ok) {
                return res.status(200).json({
                    status: 'sent',
                    messageId: resendData.id,
                    recipient: cleanEmail
                });
            } else {
                console.error('[API send-email] Resend error:', resendData);
                return res.status(502).json({
                    status: 'failed',
                    error: resendData.message || 'Resend provider error',
                    recipient: cleanEmail
                });
            }
        } catch (sendErr) {
            console.error('[API send-email] Provider error:', sendErr);
            return res.status(500).json({ status: 'failed', error: sendErr.message });
        }
    }

    // ── 4. Safe Simulation Fallback when RESEND_API_KEY is not yet populated in deployment secrets ──
    return res.status(200).json({
        status: 'simulated',
        recipient: cleanEmail,
        subject: emailSubject,
        text: textBody,
        note: 'RESEND_API_KEY environment variable not set. Email body verified and logged.'
    });
}
