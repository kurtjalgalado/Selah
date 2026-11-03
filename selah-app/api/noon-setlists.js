// Vercel Serverless Function: Automatic Sunday Setlist Completion at 12:00 Noon
// Automatically marks eligible active Sunday worship service setlists as Done at or after 12:00 noon (Asia/Manila).
// Idempotent and timezone-aware.

export default async function handler(req, res) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase configuration missing in environment.' });
    }

    // ── 1. Calculate Current Time in Asia/Manila (UTC+8) ──
    const nowUtc = new Date();
    const manilaNow = new Date(nowUtc.getTime() + (8 * 60 * 60 * 1000));
    const manilaYear = manilaNow.getUTCFullYear();
    const manilaMonth = manilaNow.getUTCMonth();
    const manilaDay = manilaNow.getUTCDate();
    const manilaHour = manilaNow.getUTCHours();
    const manilaMinute = manilaNow.getUTCMinutes();
    const manilaDayOfWeek = manilaNow.getUTCDay(); // 0 = Sunday

    const manilaTodayDateStr = `${manilaYear}-${String(manilaMonth + 1).padStart(2, '0')}-${String(manilaDay).padStart(2, '0')}`;

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    };

    try {
        // ── 2. Fetch all setlists with non-done status (or null status) ──
        const queryRes = await fetch(`${supabaseUrl}/rest/v1/setlists?select=*`, { headers });
        if (!queryRes.ok) {
            throw new Error(`Failed to query setlists: ${queryRes.statusText}`);
        }
        const setlists = await queryRes.json();

        const updatedSetlists = [];

        for (const setlist of (setlists || [])) {
            // Skip already completed or terminal status setlists
            if (setlist.status === 'done' || setlist.status === 'archived' || setlist.status === 'cancelled') {
                continue;
            }

            if (!setlist.date) continue;

            // Parse setlist service date
            const parts = String(setlist.date).split('-');
            if (parts.length !== 3) continue;

            const sYear = parseInt(parts[0], 10);
            const sMonth = parseInt(parts[1], 10) - 1;
            const sDay = parseInt(parts[2], 10);

            // Construct UTC representation of service date
            const serviceDateObj = new Date(Date.UTC(sYear, sMonth, sDay, 0, 0, 0));
            const isSunday = serviceDateObj.getUTCDay() === 0;

            // Check if title or classification indicates Sunday service
            const titleLower = (setlist.title || '').toLowerCase();
            const isSundayService = isSunday || titleLower.includes('sunday') || titleLower.includes('worship service');

            if (!isSundayService) {
                // Rule applies only to Sunday worship service setlists
                continue;
            }

            // Check if service date is in the past, or today after 12:00 PM noon
            let isEligible = false;

            if (setlist.date < manilaTodayDateStr) {
                // Missed execution from previous Sunday: recover safely!
                isEligible = true;
            } else if (setlist.date === manilaTodayDateStr) {
                // Today is Sunday: eligible if at or after 12:00 noon Manila time
                if (manilaHour >= 12) {
                    isEligible = true;
                }
            } else {
                // Future Sunday service: DO NOT mark done prematurely!
                isEligible = false;
            }

            if (isEligible) {
                const nowIso = new Date().toISOString();
                const updateRes = await fetch(`${supabaseUrl}/rest/v1/setlists?id=eq.${encodeURIComponent(setlist.id)}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        status: 'done',
                        updated_at: nowIso
                    })
                });

                if (updateRes.ok) {
                    updatedSetlists.push({
                        id: setlist.id,
                        title: setlist.title,
                        date: setlist.date,
                        status: 'done'
                    });
                }
            }
        }

        return res.status(200).json({
            message: `Completed evaluation at Manila time ${manilaTodayDateStr} ${String(manilaHour).padStart(2, '0')}:${String(manilaMinute).padStart(2, '0')}.`,
            manilaDate: manilaTodayDateStr,
            manilaHour,
            isSunday: manilaDayOfWeek === 0,
            updatedCount: updatedSetlists.length,
            updatedSetlists
        });
    } catch (err) {
        console.error('[API noon-setlists] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
