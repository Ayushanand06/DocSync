// Download the helper library from https://www.twilio.com/docs/node/install
import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

client.calls.create({
  from: "+17203364882",
  to: "+919123721048",
  url: "https://82d6-119-161-98-139.ngrok-free.app/transcribe",
}).then(call => {
  console.log(call.sid);
}).catch(error => {
  console.error(error);
});
