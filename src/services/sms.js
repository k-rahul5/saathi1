/**
 * SMS NOTIFICATION SERVICE
 * Sends SMS to workers when their complaint is resolved.
 * Uses a local server proxy (/api/send-sms) to securely call Twilio.
 * Falls back to demo mode (visual notification) if server is unavailable.
 */

const SMS_API_URL = import.meta.env.VITE_SMS_API_URL || 'http://localhost:3001/api/send-sms';

/**
 * Send SMS notification to a worker
 * @param {string} phone - Worker's phone number (10-digit Indian mobile)
 * @param {string} message - SMS body text
 * @returns {Promise<{success: boolean, mode: 'live'|'demo', message: string}>}
 */
export const sendSMS = async (phone, message) => {
  // Validate phone
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return { success: false, mode: 'demo', message: 'Invalid phone number' };
  }

  // Format to Indian number (+91)
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;

  try {
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formattedPhone, message }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, mode: 'live', message: `SMS sent to ${formattedPhone}`, sid: data.sid };
    } else {
      throw new Error('Server returned error');
    }
  } catch (err) {
    // Server not available — fall back to demo mode
    console.log(`[SMS DEMO] To: ${formattedPhone}\n${message}`);
    return {
      success: true,
      mode: 'demo',
      message: `Demo SMS → ${formattedPhone}`,
      demoBody: message
    };
  }
};

/**
 * Build a resolution SMS message
 * @param {string} workerName - Worker's name
 * @param {string} issue - Complaint issue type
 * @param {string} lang - Language code ('en' | 'te')
 */
export const buildResolutionSMS = (workerName, issue, lang = 'en') => {
  if (lang === 'te') {
    return `🟢 న్యాయశాథి: నమస్తే ${workerName}, మీ ఫిర్యాదు "${issue}" పరిష్కరించబడింది. వివరాలకు యాప్ చూడండి. — Nyaya Saathi`;
  }
  return `🟢 Nyaya Saathi: Namaste ${workerName}, your complaint "${issue}" has been RESOLVED. Check app for details. — Nyaya Saathi`;
};
