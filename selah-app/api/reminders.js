// Vercel Serverless Function: Automated 1-Day Before Minister Schedule Reminders
// Dispatches email reminders to scheduled ministers one day before their service (Asia/Manila timezone).
// Enforces persistent notification preferences and idempotency logging.

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase configuration missing in environment.' });
    }

    // ── 1. Calculate Target Service Date (Tomorrow in Asia/Manila: UTC+8) ──
    const now = new Date();
    // Offset for UTC+8
    const manilaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    // Add 1 day
    const tomorrowManila = new Date(manilaTime.getTime() + (24 * 60 * 60 * 1000));
    const targetDateStr = `${tomorrowManila.getUTCFullYear()}-${String(tomorrowManila.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowManila.getUTCDate()).padStart(2, '0')}`;

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    };

    try {
        // ── 2. Fetch all minister schedules for tomorrow ──
        const schedRes = await fetch(`${supabaseUrl}/rest/v1/minister_schedules?service_date=eq.${targetDateStr}&select=*`, { headers });
        if (!schedRes.ok) {
            throw new Error(`Failed to query minister schedules: ${schedRes.statusText}`);
        }
        const schedules = await schedRes.json();

        if (!schedules || schedules.length === 0) {
            return res.status(200).json({
                message: `No minister schedules found for target date ${targetDateStr} (Asia/Manila).`,
                targetDate: targetDateStr,
                processedCount: 0
            });
        }

        const results = [];

        // ── 3. Process each schedule and its minister assignments ──
        for (const schedule of schedules) {
            const assignments = Array.isArray(schedule.assignments) ? schedule.assignments : [];

            for (const assignment of assignments) {
                const ministerEmail = assignment.user_email || assignment.email;
                const ministerId = assignment.user_id || assignment.id;
                const ministerName = assignment.user_name || assignment.name || 'Worship Minister';
                const roleName = assignment.role_name || assignment.role || 'Worship Team Member';

                if (!ministerEmail || !ministerEmail.includes('@')) {
                    continue;
                }

                const cleanEmail = ministerEmail.trim().toLowerCase();
                const idempotencyKey = `remind_1d_${schedule.id}_${assignment.id || ministerId}_${targetDateStr}`;

                // A. Check idempotency: already sent or recorded?
                const checkLogRes = await fetch(`${supabaseUrl}/rest/v1/minister_reminder_logs?id=eq.${encodeURIComponent(idempotencyKey)}&select=id,status`, { headers });
                if (checkLogRes.ok) {
                    const existingLogs = await checkLogRes.json();
                    if (existingLogs && existingLogs.length > 0 && existingLogs[0].status === 'sent') {
                        results.push({
                            id: idempotencyKey,
                            recipient: cleanEmail,
                            status: 'already_sent'
                        });
                        continue;
                    }
                }

                // B. Enforce account-level notification preference
                let emailAllowed = true;
                if (ministerId) {
                    // Check notification_preferences table
                    const prefRes = await fetch(`${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${ministerId}&select=email_enabled`, { headers });
                    if (prefRes.ok) {
                        const prefs = await prefRes.json();
                        if (prefs && prefs.length > 0 && prefs[0].email_enabled === false) {
                            emailAllowed = false;
                        }
                    }

                    // Also check profiles
                    if (emailAllowed) {
                        const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${ministerId}&select=email_enabled`, { headers });
                        if (profRes.ok) {
                            const profs = await profRes.json();
                            if (profs && profs.length > 0 && profs[0].email_enabled === false) {
                                emailAllowed = false;
                            }
                        }
                    }
                }

                if (!emailAllowed) {
                    // Record suppression in minister_reminder_logs
                    await fetch(`${supabaseUrl}/rest/v1/minister_reminder_logs`, {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({
                            id: idempotencyKey,
                            schedule_id: String(schedule.id),
                            minister_id: ministerId ? String(ministerId) : null,
                            minister_email: cleanEmail,
                            service_date: targetDateStr,
                            service_time: schedule.service_time || '',
                            role: roleName,
                            status: 'suppressed',
                            suppression_reason: 'Recipient disabled email notifications.',
                            notes: schedule.notes || '',
                            updated_at: new Date().toISOString()
                        })
                    });

                    results.push({
                        id: idempotencyKey,
                        recipient: cleanEmail,
                        status: 'suppressed',
                        reason: 'email_disabled'
                    });
                    continue;
                }

                // C. Send reminder email via internal send-email helper
                const siteOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://jfcm-selah.vercel.app';
                const sendRes = await fetch(`${siteOrigin}/api/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: cleanEmail,
                        name: ministerName,
                        serviceTitle: schedule.serviceTitle || 'Worship Service',
                        serviceDate: targetDateStr,
                        serviceTime: schedule.service_time || '',
                        roleName: roleName,
                        notes: schedule.notes || 'No additional service notes.',
                        churchName: (schedule.church_id && schedule.church_id !== 'JFCM-Mercedes') ? schedule.church_id : 'Jesus First Christian Ministries'
                    })
                });

                const sendData = sendRes.ok ? await sendRes.json() : { status: 'failed' };

                // D. Update durable audit log
                await fetch(`${supabaseUrl}/rest/v1/minister_reminder_logs`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({
                        id: idempotencyKey,
                        schedule_id: String(schedule.id),
                        minister_id: ministerId ? String(ministerId) : null,
                        minister_email: cleanEmail,
                        service_date: targetDateStr,
                        service_time: schedule.service_time || '',
                        role: roleName,
                        status: sendData.status || 'sent',
                        notes: schedule.notes || '',
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                });

                results.push({
                    id: idempotencyKey,
                    recipient: cleanEmail,
                    status: sendData.status || 'sent'
                });
            }
        }

        return res.status(200).json({
            message: `Processed reminders for ${targetDateStr}.`,
            targetDate: targetDateStr,
            results
        });
    } catch (err) {
        console.error('[API reminders] Processing error:', err);
        return res.status(500).json({ error: err.message });
    }
}
