'use strict';
// Decode a JWT payload's `exp` (as ms-epoch) WITHOUT verifying the signature.
// This is display/diagnostics only (token-expiry hints in the dashboard, doctor,
// and pool status) — it must never gate an auth decision. Real token validity is
// checked by a live request to DeepSeek (server.js checkAccountLive).
//
// Shared by server.js and scripts/doctor.js so both agree on expiry math.
function decodeTokenInfo(token) {
    try {
        const payload = String(token).split('.')[1];
        const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return { exp: p.exp ? p.exp * 1000 : null };
    } catch {
        return { exp: null };
    }
}

module.exports = { decodeTokenInfo };
