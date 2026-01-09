# Secrets Inventory & Transfer Guide

Complete documentation of all secrets (environment variables) required for the Worksite Sync application.

---

## Overview

This document lists all secrets needed for edge functions to work correctly. **Secrets must be configured in your new Supabase project before edge functions will work.**

**Where to configure**: Supabase Dashboard > Settings > Edge Functions > Secrets

---

## Required Secrets

### 1. GOOGLE_GEOCODING_API_KEY

**Purpose**: Converts UK postcodes to GPS coordinates (latitude/longitude)

**Used By**:
- `geocode-postcode` edge function

**How to Obtain**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable "Geocoding API" in API Library
4. Go to Credentials
5. Create API Key
6. **Restrict the key**:
   - Application restrictions: HTTP referrers (websites)
   - Add your domain
   - API restrictions: Geocoding API only
7. Copy the API key

**Cost**: Free for up to 40,000 requests/month, then $0.005 per request

**Security Level**: 🔴 HIGH - Keep secret, restrict by domain/IP

**Required**: ✅ YES (geocoding won't work without it)

**Example Value**: `AIzaSyB1234567890abcdefghijklmnopqrstuvw`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: GOOGLE_GEOCODING_API_KEY
Value: [Paste your API key here]
```

---

### 2. RESEND_API_KEY

**Purpose**: Sends transactional emails (demo requests, notifications)

**Used By**:
- `send-demo-request` edge function
- `send-amendment-notification` edge function (if email notifications enabled)

**How to Obtain**:
1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Verify your domain (or use test mode)
4. Go to API Keys section
5. Create new API key
6. Copy the key (starts with `re_`)

**Cost**: Free for 3,000 emails/month, then $1 per 1,000 emails

**Security Level**: 🔴 HIGH - Keep secret, never expose

**Required**: ✅ YES (emails won't send without it)

**Example Value**: `re_123456789_AbCdEfGhIjKlMnOpQrStUvWx`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: RESEND_API_KEY
Value: [Paste your Resend API key here]
```

---

### 3. FROM_EMAIL

**Purpose**: Sender email address for outgoing emails

**Used By**:
- `send-demo-request` edge function
- `send-amendment-notification` edge function (if email notifications enabled)

**How to Set**:
1. Verify a domain in Resend
2. Use format: `noreply@yourdomain.com` or `notifications@yourdomain.com`
3. Must be from verified domain in Resend

**Cost**: Free (part of Resend service)

**Security Level**: 🟡 MEDIUM - Not secret, but should be legitimate

**Required**: ✅ YES (emails won't send without it)

**Example Value**: `noreply@worksitesync.com`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: FROM_EMAIL
Value: noreply@yourdomain.com
```

---

### 4. TO_EMAIL

**Purpose**: Recipient email address for demo requests

**Used By**:
- `send-demo-request` edge function

**How to Set**:
1. Use your admin/sales team email
2. This is where demo requests will be sent

**Cost**: Free

**Security Level**: 🟡 MEDIUM - Internal email address

**Required**: ✅ YES for demo requests (demo form won't notify you without it)

**Example Value**: `sales@worksitesync.com` or `admin@yourdomain.com`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: TO_EMAIL
Value: admin@yourdomain.com
```

---

## Optional Secrets

### 5. ALLOWED_ORIGINS

**Purpose**: CORS (Cross-Origin Resource Sharing) configuration for edge functions

**Used By**:
- All edge functions (for security)

**How to Set**:
1. List your allowed domains separated by commas
2. Include protocol (https://)
3. Include all subdomains if needed

**Cost**: Free

**Security Level**: 🟡 MEDIUM - Controls which domains can call your functions

**Required**: ⚠️ OPTIONAL (but recommended for production)

**Example Value**: `https://worksitesync.com,https://www.worksitesync.com,https://app.worksitesync.com`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: ALLOWED_ORIGINS
Value: https://yourdomain.com,https://www.yourdomain.com
```

**When to Use**:
- Production environment
- When you have a custom domain
- When you want to restrict API access

---

### 6. SITE_URL

**Purpose**: Your application's public URL (for generating links in emails)

**Used By**:
- Email templates
- Password reset flows
- Deep linking

**How to Set**:
1. Use your production domain
2. Include protocol (https://)
3. No trailing slash

**Cost**: Free

**Security Level**: 🟢 LOW - Public information

**Required**: ⚠️ OPTIONAL (but recommended for better user experience)

**Example Value**: `https://app.worksitesync.com`

**How to Add**:
```bash
# In Supabase Dashboard > Edge Functions > Secrets
Name: SITE_URL
Value: https://yourdomain.com
```

---

## Auto-Provided Secrets

These are automatically available in edge functions and **do not need to be configured**:

### SUPABASE_URL
**Purpose**: Your Supabase project URL  
**Provided By**: Supabase automatically  
**Example**: `https://abcdefghij.supabase.co`

### SUPABASE_ANON_KEY
**Purpose**: Public/anonymous key for Supabase client  
**Provided By**: Supabase automatically  
**Security**: 🟢 Safe to use in frontend

### SUPABASE_SERVICE_ROLE_KEY
**Purpose**: Admin key with full database access  
**Provided By**: Supabase automatically  
**Security**: 🔴 NEVER expose in frontend, only use in edge functions

---

## Security Best Practices

### ✅ DO:
- Store all secrets in Supabase Edge Functions Secrets
- Rotate API keys regularly (every 6-12 months)
- Use separate API keys for development and production
- Restrict API keys by domain/IP when possible
- Monitor API key usage for suspicious activity
- Use environment-specific secrets (dev, staging, prod)

### ❌ DON'T:
- Never commit secrets to git
- Never expose secrets in frontend code
- Never share secrets via insecure channels (Slack, email)
- Never use production secrets in development
- Never reuse secrets across projects
- Never hardcode secrets in edge functions

---

## Secret Configuration Checklist

Use this checklist when setting up secrets in new Supabase project:

### Required Secrets
- [ ] GOOGLE_GEOCODING_API_KEY - Obtained and configured
- [ ] RESEND_API_KEY - Obtained and configured
- [ ] FROM_EMAIL - Set to verified domain email
- [ ] TO_EMAIL - Set to admin/sales email

### Optional Secrets (Recommended for Production)
- [ ] ALLOWED_ORIGINS - Configured with production domains
- [ ] SITE_URL - Set to production URL

### Verification
- [ ] All secrets show "Last updated" timestamp in dashboard
- [ ] No secrets visible in browser developer tools
- [ ] Edge functions logs show secrets are being used (not showing "undefined")
- [ ] Tested geocoding functionality (creates job with postcode)
- [ ] Tested email sending (submitted demo request)

---

## Testing Secret Configuration

### Test Geocoding
```bash
# Create a job with UK postcode in your app
# Check if latitude/longitude are populated
# If not, check edge function logs for GOOGLE_GEOCODING_API_KEY errors
```

### Test Email Sending
```bash
# Submit demo request from landing page
# Check TO_EMAIL inbox for received email
# If no email, check edge function logs for RESEND_API_KEY errors
```

### View Edge Function Logs
1. Go to Supabase Dashboard
2. Edge Functions
3. Click on function name (e.g., geocode-postcode)
4. View logs for errors or success messages
5. Look for error messages mentioning missing secrets

---

## Troubleshooting

### Error: "GOOGLE_GEOCODING_API_KEY is not defined"
**Solution**: Add the secret in Supabase Dashboard > Edge Functions > Secrets

### Error: "API key not valid"
**Solution**: 
- Check API key is copied correctly (no extra spaces)
- Verify API is enabled in Google Cloud Console
- Check API key restrictions allow your domain

### Error: "Invalid from address"
**Solution**:
- Verify domain in Resend
- Ensure FROM_EMAIL uses verified domain
- Check FROM_EMAIL format (must be valid email)

### Error: "Failed to send email"
**Solution**:
- Verify RESEND_API_KEY is correct
- Check Resend dashboard for any account issues
- Verify FROM_EMAIL is from verified domain
- Check edge function logs for detailed error

### Geocoding not working
**Solution**:
- Verify GOOGLE_GEOCODING_API_KEY is set
- Check Google Cloud Console API is enabled
- Verify API key has Geocoding API enabled
- Check for API quota limits

---

## Secret Transfer Process

When migrating from old to new Supabase project:

1. **Export current secrets** (manually note them down):
   - Open old Supabase project
   - Go to Settings > Edge Functions > Secrets
   - Copy each secret value (they're hidden, you may need to regenerate)

2. **Import to new project**:
   - Open new Supabase project
   - Go to Settings > Edge Functions > Secrets
   - Add each secret with same name and value

3. **Verify transfer**:
   - Check all secrets listed in new project
   - Test functionality (geocoding, emails)
   - Check edge function logs for any missing secrets

---

## Cost Estimation

| Secret | Service | Free Tier | Cost After Free |
|--------|---------|-----------|-----------------|
| GOOGLE_GEOCODING_API_KEY | Google Maps | 40,000 requests/month | $0.005/request |
| RESEND_API_KEY | Resend | 3,000 emails/month | $1/1,000 emails |
| FROM_EMAIL | Resend | Included | Free |
| TO_EMAIL | N/A | Free | Free |
| ALLOWED_ORIGINS | N/A | Free | Free |
| SITE_URL | N/A | Free | Free |

**Estimated Monthly Cost** (typical usage for small-medium business):
- Geocoding: ~500 requests/month = **FREE**
- Emails: ~500 emails/month = **FREE**
- **Total: $0/month** (well within free tiers)

---

## Alternative Services

If you want to use different providers:

### Alternative to Google Geocoding:
- **Mapbox Geocoding API**: 100,000 requests/month free
- **OpenCage Geocoding**: 2,500 requests/day free
- **Nominatim (OpenStreetMap)**: Free, but rate-limited

### Alternative to Resend:
- **SendGrid**: 100 emails/day free
- **Mailgun**: 5,000 emails/month free for 3 months
- **Amazon SES**: $0.10 per 1,000 emails

---

## Security Incident Response

If a secret is compromised:

1. **Immediately**:
   - [ ] Revoke the compromised secret in service provider
   - [ ] Generate new secret
   - [ ] Update in Supabase project
   - [ ] Redeploy edge functions

2. **Within 24 hours**:
   - [ ] Review access logs for suspicious activity
   - [ ] Audit other secrets for potential exposure
   - [ ] Document incident
   - [ ] Review security practices

3. **Follow-up**:
   - [ ] Implement additional restrictions on new secret
   - [ ] Review code for potential exposure points
   - [ ] Update security documentation
   - [ ] Train team on secret handling

---

## Questions?

If you have questions about secrets configuration:
1. Check edge function logs for specific errors
2. Review Supabase documentation on edge functions
3. Check service provider documentation (Google, Resend)
4. Contact support for the specific service

---

**Last Updated**: This document should be updated when new secrets are added or removed.

**Document Version**: 1.0  
**Created For**: Worksite Sync Database Migration
