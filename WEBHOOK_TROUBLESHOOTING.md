# WhatsApp Webhook Troubleshooting Guide

## ✅ What Was Fixed in the Code

### 1. **Immediate 200 Response**
- **Problem**: Meta requires a 200 response within 20 seconds, or it will retry/fail
- **Fix**: Now responds with `res.sendStatus(200)` immediately at the start
- **Impact**: Prevents timeout errors from Meta

### 2. **Full Request Logging**
- **Problem**: You couldn't see what Meta was actually sending
- **Fix**: Added `JSON.stringify(req.body, null, 2)` to log complete payload
- **Impact**: You can now debug exactly what Meta is sending

### 3. **Status Updates Handling**
- **Problem**: Meta sends status updates (delivered, read, sent) which were being processed as messages
- **Fix**: Added check for `value?.statuses` and skip processing
- **Impact**: Prevents errors from non-message webhooks

### 4. **Better Error Handling**
- **Problem**: Code could crash on unexpected data
- **Fix**: Added null-safe checks (`message.text?.body`) and detailed error logging
- **Impact**: More stable and easier to debug

---

## 🔍 Meta Configuration Checklist

### Step 1: Verify Your Webhook URL is Accessible
1. Make sure your server is running and publicly accessible
2. Test the webhook verification endpoint:
   ```
   https://your-domain.com/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123
   ```
   Should return: `test123`

### Step 2: Check Meta App Configuration
Go to [Meta for Developers](https://developers.facebook.com/apps/)

#### A. WhatsApp Business API Settings
1. Navigate to: **WhatsApp** → **Configuration**
2. **Webhook URL**: Should be `https://your-domain.com/webhook`
3. **Verify Token**: Must match your `.env` file's `VERIFY_TOKEN`
4. Click **Verify and Save**

#### B. Webhook Subscriptions
1. In the same Configuration page, scroll to **Webhook fields**
2. **MUST SUBSCRIBE TO**: `messages` (this is critical!)
3. Optional but recommended:
   - `message_status` (for delivery/read receipts)
   - `message_echoes` (for messages you send)

### Step 3: Verify Environment Variables
Check your `.env` file has all required values:
```env
VERIFY_TOKEN=your_verify_token_here
WHATSAPP_TOKEN=your_whatsapp_access_token
PHONE_NUMBER_ID=your_phone_number_id
GROQ_API_KEY=your_groq_api_key
PORT=3000
```

### Step 4: Check Access Token
1. Go to **WhatsApp** → **API Setup**
2. Your **Temporary access token** expires in 24 hours
3. For production, generate a **Permanent token**:
   - Go to **System Users** in Business Settings
   - Create a system user
   - Generate a permanent token with `whatsapp_business_messaging` permission

### Step 5: Test Number Configuration
1. Go to **WhatsApp** → **API Setup**
2. Under **To**, add your test phone number
3. You'll receive a verification code via WhatsApp
4. Enter the code to verify

---

## 🧪 Testing Steps

### 1. Restart Your Server
```bash
node index.js
```

You should see:
```
Server running on port 3000
```

### 2. Send a Test Message
1. Send a WhatsApp message to your business number
2. Check your server logs for:
   ```
   📥 Webhook POST received
   Full Body: { ... }
   ```

### 3. Check for Common Issues

#### ❌ No webhook POST received at all
**Possible causes:**
- Webhook URL not verified in Meta
- Not subscribed to `messages` field
- Server not publicly accessible
- Firewall blocking requests

**Solution:**
- Re-verify webhook in Meta dashboard
- Check webhook subscriptions
- Use ngrok if testing locally: `ngrok http 3000`

#### ❌ Webhook received but no message object
**Check logs for:**
```
⚠️ No message found in webhook
```

**Possible causes:**
- Meta is sending status updates only
- Message format changed

**Solution:**
- Check the `Full Body` log to see what Meta is sending
- Verify you're sending from a verified test number

#### ❌ Error: "Access token has expired"
**Solution:**
- Generate a new access token from Meta dashboard
- Update `WHATSAPP_TOKEN` in `.env`
- Restart server

#### ❌ Error: "Recipient phone number not available"
**Solution:**
- Add the recipient number in Meta dashboard under "To" field
- Verify the number with the code sent via WhatsApp

---

## 📊 Understanding the Logs

### Successful Message Flow:
```
📥 Webhook POST received
Full Body: { "entry": [...], "object": "whatsapp_business_account" }
📨 Message Type: text
📨 Message Object: { "from": "1234567890", "text": { "body": "Hello" } }
👤 User (1234567890): Hello
🤖 AI Reply: Hi! How can I help you?
✅ Reply sent successfully
```

### Status Update (Normal, not an error):
```
📥 Webhook POST received
Full Body: { ... }
📊 Status Update: [{ "status": "delivered", ... }]
```

### No Message (Normal for some webhook types):
```
📥 Webhook POST received
Full Body: { ... }
⚠️ No message found in webhook
```

---

## 🚀 Next Steps

1. **Restart your server** with the updated code
2. **Check Meta webhook configuration** (especially subscriptions)
3. **Send a test message** to your WhatsApp business number
4. **Monitor the logs** to see what's happening
5. **Share the logs** if you still don't see any POST requests

---

## 🆘 Still Not Working?

If you're still not receiving webhooks, please check:

1. **Server logs** - Share the complete output
2. **Meta webhook logs** - Go to WhatsApp → Configuration → Webhook → View Logs
3. **Network accessibility** - Can Meta reach your server?
4. **Webhook verification** - Is it showing as verified in Meta dashboard?

The most common issue is **not subscribing to the `messages` webhook field** in Meta's dashboard!
