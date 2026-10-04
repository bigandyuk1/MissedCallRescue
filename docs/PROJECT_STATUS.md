# MissedCall Rescue - Project Status

Last updated: 2 October 2026

## Project Purpose

MissedCall Rescue is a standalone service for small businesses that converts unanswered telephone calls into recoverable customer enquiries.

The customer keeps their existing advertised business telephone number.

When a call is not answered:

1. The customer's mobile network conditionally forwards the call to a MissedCall Rescue Twilio number.
2. Twilio sends the incoming call to the MissedCall Rescue application.
3. MissedCall Rescue answers with a short voice message.
4. The call is ended.
5. MissedCall Rescue sends an SMS to the original caller.
6. The caller can reply to that SMS.
7. The inbound reply is received by MissedCall Rescue.
8. An enquiry record is created and stored in MongoDB.

Key Control Auto Locksmiths is currently the first real-world test customer.

---

## Current Status

The complete core workflow has been successfully tested with real telephone calls and SMS messages.

PROVEN WORKING:

Existing KeyControl number
    -> EE conditional no-answer forwarding
    -> Twilio
    -> Cloudflare Tunnel
    -> Node.js / Express application
    -> Voice response
    -> Outbound SMS
    -> Customer SMS reply
    -> Inbound SMS webhook
    -> Structured enquiry
    -> MongoDB Atlas persistence

This is no longer just a simulated/test flow.

Multiple external mobile phones have successfully called the KeyControl number and triggered the system.

---

## Local Development Environment

Project directory:

C:\MissedCallRescue

Application port:

3100

Start application:

node index.js

Main project files:

index.js
enquiry.js
attach-twiml.js
package.json
package-lock.json
.env
.gitignore
docs\
Logo\

The Logo directory is intentionally excluded from Git.

---

## Git

Git repository initialised:

C:\MissedCallRescue\.git

First known-good commit:

7b1b03e

Commit message:

Initial MissedCall Rescue working prototype

This commit represents the first proven end-to-end working prototype.

Before major changes, this commit can be used as a known-good recovery point.

---

## .gitignore

The following are deliberately excluded from Git:

.env
node_modules/
Logo/

NEVER commit .env.

---

## Environment Variables

The application uses dotenv.

Installed with:

npm install dotenv

index.js loads it with:

require("dotenv").config();

.env currently contains configuration for:

MONGODB_URI
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

DO NOT place actual passwords, Auth Tokens or MongoDB connection strings in this document or Git.

---

## Twilio

Twilio account is upgraded from trial to paid.

MissedCall Rescue UK Twilio mobile number:

+44 7445 169227
UK format: 07445 169227

IMPORTANT:

An incorrect number was previously transcribed during development:

+44 7444 5169227

THIS NUMBER IS WRONG AND MUST NEVER BE USED.

Correct number:

+44 7445 169227

Twilio Phone Number SID:

PN4f456e567705dc9e6982fc1f9b4b1fcd

Twilio number capabilities:

Voice: Yes
SMS: Yes
MMS: No
Fax: No

UK compliance registration has been approved.

---

## TwiML Application

Friendly name:

MissedCall Rescue

TwiML App SID:

APff964a241f8330f6f2f1b1ea75f4eeae

Current voice endpoint:

/incoming-call

HTTP method:

POST

attach-twiml.js was used successfully to associate the Twilio telephone number with the TwiML application.

---

## Voice Behaviour

When an unanswered KeyControl call reaches MissedCall Rescue, the service answers with a short voice message.

Current wording:

"Thanks for calling. We can't answer your call right now. We'll send you a text message shortly."

Voice:

Polly.Amy

The call is then ended.

---

## Outbound SMS

After the missed call, MissedCall Rescue sends an SMS to the original caller.

Current branding starts with:

KEY CONTROL AUTO LOCKSMITHS:

The current concept asks the caller to reply with information such as:

- vehicle registration
- postcode
- work/help required

SMS is deliberately sent from the Twilio number so that the caller can reply directly.

An alphanumeric sender ID is NOT currently being used because two-way SMS replies are required.

---

## Inbound SMS

Twilio's inbound SMS webhook is configured to send replies back to the MissedCall Rescue application.

Successfully tested examples include:

Ford Focus 2018 - spare key - BS16 7EJ

Vauxhall Corsa 2019 spare key BS16 7EJ

and a simple reply:

Hi xxx

The application logs:

[SMS RECEIVED]

and:

[SMS BODY]

It also creates a structured enquiry object.

Example structure:

{
    caller: "+4477xxxxxxxx",
    message: "Vauxhall Corsa 2019 spare key BS16 7EJ",
    receivedAt: "ISO timestamp"
}

---

## MongoDB

MongoDB Atlas account already existed for KeyControl.

Current cluster:

keycontrol-dev

Provider:

AWS

Region:

Ireland / eu-west-1

MissedCall Rescue deliberately uses a separate logical database rather than the KeyControl database.

Database:

missedcallrescue

Collection:

enquiries

This maintains separation between:

KeyControl = customer/business system

MissedCall Rescue = standalone commercial product

They may integrate later through an API rather than sharing application data directly.

---

## MongoDB Application User

Dedicated Atlas database user:

missedcallrescue_app

Authentication:

Password / SCRAM

Permissions:

readWrite on database:

missedcallrescue

The user is NOT intended to have application access to the KeyControl database.

Password must remain secret and must not be documented here.

---

## Mongoose

Mongoose is installed.

enquiry.js defines the Enquiry model.

Current fields:

caller
    String
    required

message
    String
    required

receivedAt
    Date
    defaults to Date.now

MongoDB connection is made from index.js using:

mongoose.connect(process.env.MONGODB_URI)

Successful startup produces:

[DATABASE] Connected to MongoDB

---

## Proven MongoDB Persistence

A real inbound SMS was successfully stored in Atlas.

Example test:

Caller:
+447733265573

Message:
Hi xxx

MongoDB successfully returned an enquiry ID.

Another successful test:

Vauxhall Corsa 2019 spare key BS16 7EJ

Atlas Data Explorer was manually checked and confirmed that the enquiry existed in:

missedcallrescue
    -> enquiries

Therefore persistence has been independently verified and is not merely console logging.

---

## EE / KeyControl Real-World Test

KeyControl's mobile service is now EE Pay Monthly.

Conditional call forwarding for:

WHEN UNANSWERED

has been configured on the Samsung Galaxy Z Fold.

Real-world behaviour:

Caller rings normal KeyControl telephone number.

If KeyControl answers:
    normal telephone call continues.

If KeyControl does not answer:
    EE forwards the call to MissedCall Rescue.

MissedCall Rescue then answers and sends the SMS.

This has been tested successfully.

Do not alter the working forwarding configuration unnecessarily.

---

## Cloudflare Tunnel

Development currently uses a Cloudflare Quick Tunnel.

Known working tunnel during development:

https://macro-village-despite-radios.trycloudflare.com

IMPORTANT:

This is a temporary Quick Tunnel URL.

If cloudflared is restarted, the URL may change.

If the URL changes, Twilio webhook/TwiML URLs must also be updated.

A permanent hostname/tunnel is future work.

Do NOT make DNS changes to keycontrolauto.co.uk casually.

The existing KeyControl website is live and must not be put at risk while developing MissedCall Rescue.

Document existing DNS and rollback procedures before any future DNS migration.

---

## Important Credential Lesson

During testing, Node was started from the VS Code terminal and SMS sending failed with:

[SMS FAILED] username is required

The reason was that TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN existed in a different Windows process/environment but were not visible to the VS Code Node process.

Twilio configuration was therefore moved into the protected .env file.

After doing this, a real test produced:

[MISSED CALL] Incoming call from: <caller>
[SMS SENT] <Twilio Message SID> -> <caller>

and the customer's subsequent reply was received and stored in MongoDB.

Therefore the application should NOT rely on terminal-specific Windows environment variables.

---

## Security Rules

Never expose or commit:

Twilio Auth Token
MongoDB password
MongoDB connection URI
Other customer credentials

.env must remain Git ignored.

Do not paste credentials into ChatGPT conversations.

Use least-privilege MongoDB users.

---

## Product Architecture Principle

MissedCall Rescue must remain a standalone commercial product.

KeyControl Auto Locksmiths is the first customer/test implementation.

Do NOT tightly couple the application to KeyControl.

Long-term architecture should support multiple independent businesses with their own:

- telephone configuration
- business identity
- SMS wording
- enquiries
- users
- settings
- subscriptions

Customer isolation will be required before this becomes a production SaaS service.

---

## Current Development Checkpoint

As of 2 October 2026:

WORKING:

- Node/Express application
- Twilio inbound voice
- caller ID capture
- voice response
- outbound SMS
- inbound SMS replies
- structured enquiry creation
- MongoDB Atlas connection
- persistent enquiry storage
- EE real-world conditional forwarding
- dotenv configuration
- protected secrets
- Git repository
- known-good initial Git commit

NOT YET BUILT:

- enquiry management UI
- enquiry list/dashboard
- enquiry status/workflow
- business/customer accounts
- multi-tenant isolation
- configurable business profile
- authentication
- production hosting
- permanent Cloudflare/domain configuration
- subscription/billing system
- production monitoring
- onboarding workflow

---

## Next Development Step

The immediate next feature is to make stored enquiries usable without opening MongoDB Atlas.

Build an application/API view that can retrieve enquiries from MongoDB, followed by a simple MissedCall Rescue enquiry dashboard.

Do this incrementally and preserve the known-good working telephone/SMS flow.

---

## Working Method

Development should be carried out through VS Code.

Make small changes.

Test each change before proceeding.

Use Git checkpoints after working milestones.

Do not make several unrelated infrastructure/application changes at once.

When resuming this project in a future ChatGPT conversation:

READ THIS FILE FIRST.

Do not reconstruct the project from assumptions or outdated memory.

## Permanent Cloudflare Tunnel - 4 October 2026

MissedCall Rescue has now been moved from the temporary Cloudflare Quick Tunnel to a permanent named Cloudflare Tunnel.

### Domain

- Domain: `missedcallrescue.uk`
- Public application hostname: `api.missedcallrescue.uk`
- KeyControl DNS and `keycontrolauto.co.uk` were not changed.

### Cloudflare Tunnel

- Tunnel name: `missedcall-rescue`
- Tunnel installed as a Windows service.
- Tunnel status confirmed Healthy.
- Published application:
  - `https://api.missedcallrescue.uk`
  - Service: `http://localhost:3100`

The dashboard was successfully accessed through:

`https://api.missedcallrescue.uk`

### Twilio Webhooks

The temporary `trycloudflare.com` URLs have been replaced.

Inbound SMS:

`https://api.missedcallrescue.uk/incoming-sms`

Voice / TwiML App:

`https://api.missedcallrescue.uk/incoming-call`

Both use HTTP POST.

### End-to-End Tests

Inbound SMS was tested successfully through the permanent hostname and created an enquiry in MongoDB.

A full live call test was also successful:

Customer call
→ KeyControl EE number
→ unanswered conditional forwarding
→ Twilio
→ Cloudflare named tunnel
→ MissedCall Rescue
→ voice response
→ rescue SMS

Customer SMS replies also successfully reach MissedCall Rescue through the permanent Cloudflare endpoint and are stored in MongoDB.

The temporary Cloudflare Quick Tunnel is no longer required for the Twilio voice or SMS webhooks.