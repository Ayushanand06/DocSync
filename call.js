const twilio = require("twilio");
require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_FROM_NUMBER;
const to = process.env.TWILIO_TO_NUMBER;
const voiceUrl = process.env.TWILIO_VOICE_URL;

if (!accountSid || !authToken || !from || !to || !voiceUrl) {
  console.error(
    "Missing Twilio configuration. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER, and TWILIO_VOICE_URL."
  );
  process.exit(1);
}

const client = twilio(accountSid, authToken);

client.calls
  .create({
    from,
    to,
    url: voiceUrl,
  })
  .then((call) => {
    console.log(call.sid);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
