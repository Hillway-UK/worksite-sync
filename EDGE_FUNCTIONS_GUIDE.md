# Edge Functions Reference Guide

Complete documentation for all 12 edge functions in the Worksite Sync application.

---

## Overview

Edge functions are serverless functions that run on Supabase's global network. They handle:
- Authentication operations (password changes, resets)
- Organization management (setup, deletion)
- External API integrations (geocoding, email)
- Business logic (subscriptions, notifications)

**Deployment**: Automatically handled by CI/CD when you update code  
**Runtime**: Deno (TypeScript/JavaScript)  
**Location**: `supabase/functions/` directory

---

## Function Summary

| Function | Public? | JWT Required | Purpose |
|----------|---------|--------------|---------|
| delete-organization | ❌ | ✅ Yes | Delete entire organization and data |
| delete-user | ❌ | ✅ Yes | Remove user from system |
| geocode-postcode | ✅ | ❌ No | Convert UK postcode to coordinates |
| import-uk-postcodes | ❌ | ✅ Yes | Bulk import postcode data |
| manager-change-password | ❌ | ✅ Yes | Manager password update |
| reconcile-subscription | ❌ | ✅ Yes | Sync subscription counts |
| reset-manager-password | ❌ | ✅ Yes | Password reset functionality |
| secure-profile-operations | ❌ | ✅ Yes | Secure profile updates |
| send-amendment-notification | ✅ | ❌ No | Notify workers of amendment decisions |
| send-demo-request | ✅ | ❌ No | Send demo request emails |
| setup-organization | ✅ | ❌ No | Create new organization on signup |
| upgrade-subscription-plan | ❌ | ✅ Yes | Handle subscription upgrades |

---

## Authentication Functions

### 1. manager-change-password

**Purpose**: Allows authenticated managers to change their password securely

**Path**: `supabase/functions/manager-change-password/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None (uses built-in Supabase auth)

**Request Body**:
```json
{
  "email": "manager@example.com",
  "newPassword": "newSecurePassword123"
}
```

**Response Success**:
```json
{
  "message": "Password updated successfully"
}
```

**Response Error**:
```json
{
  "error": "Manager not found or unauthorized"
}
```

**Security**:
- Requires valid JWT token in Authorization header
- Verifies user is actually a manager
- Uses Supabase service role for password update
- Logs security events

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('manager-change-password', {
  body: { email: 'manager@example.com', newPassword: 'newPassword123' }
});
```

**Common Errors**:
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is not a manager
- `404 Not Found`: Manager not found in database

---

### 2. reset-manager-password

**Purpose**: Password reset functionality for managers

**Path**: `supabase/functions/reset-manager-password/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "email": "manager@example.com"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Security**:
- Requires authentication
- Sends password reset email via Supabase auth
- Rate limited to prevent abuse

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('reset-manager-password', {
  body: { email: 'manager@example.com' }
});
```

---

### 3. secure-profile-operations

**Purpose**: Handle secure profile updates with enhanced security

**Path**: `supabase/functions/secure-profile-operations/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "operation": "update",
  "userType": "manager",
  "data": {
    "name": "Updated Name",
    "phone": "+44 123 456 7890"
  }
}
```

**Response Success**:
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Updated Name", ... }
}
```

**Security**:
- Validates user can only update their own profile
- Sanitizes input data
- Prevents privilege escalation
- Logs all profile changes

---

## Organization Management Functions

### 4. setup-organization

**Purpose**: Creates new organization, super admin, and initial setup during registration

**Path**: `supabase/functions/setup-organization/index.ts`

**JWT Required**: ❌ NO (Public function for signup)

**Required Secrets**: None

**Request Body**:
```json
{
  "orgData": {
    "name": "Acme Construction Ltd",
    "company_number": "12345678",
    "vat_number": "GB123456789",
    "address": "123 Main St, London",
    "phone": "+44 20 1234 5678",
    "email": "info@acme.com",
    "admin_email": "admin@acme.com",
    "admin_name": "John Smith"
  },
  "userId": "uuid-of-auth-user"
}
```

**Response Success**:
```json
{
  "success": true,
  "organization_id": "uuid",
  "message": "Organization and admin created successfully"
}
```

**What It Does**:
1. Creates organization record
2. Sets subscription to 'trial' (14 days)
3. Creates super admin record
4. Links admin to organization
5. Sets initial capacity limits (3 managers, 10 workers)

**Security Considerations**:
- Public function (no JWT) to allow signup
- Uses service role to bypass RLS
- Validates input data
- Prevents duplicate organizations

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('setup-organization', {
  body: { orgData: {...}, userId: authUser.id }
});
```

---

### 5. delete-organization

**Purpose**: Deletes entire organization and all related data (cascading delete)

**Path**: `supabase/functions/delete-organization/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "organizationId": "uuid"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Organization deleted successfully"
}
```

**What Gets Deleted** (cascading):
- Organization record
- All super admins
- All managers
- All workers
- All jobs
- All time entries
- All time amendments
- All expense types
- All additional costs
- All photos
- All subscription records

**Security**:
- Requires super admin authentication
- Verifies user owns the organization
- Uses service role for deletion
- Irreversible operation (no soft delete)

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('delete-organization', {
  body: { organizationId: 'uuid' }
});
```

**Warning**: ⚠️ This is a destructive operation. Ensure user confirmation before calling.

---

### 6. delete-user

**Purpose**: Removes a user (manager or worker) from the system

**Path**: `supabase/functions/delete-user/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "email": "user@example.com",
  "table": "workers"
}
```

**Parameters**:
- `email`: User's email address
- `table`: Either `"workers"` or `"managers"`

**Response Success**:
```json
{
  "success": true
}
```

**What It Does**:
1. Finds auth.users record by email
2. Deletes from specified table (workers or managers)
3. Deletes from auth.users
4. Cascading deletes trigger for related records

**Security**:
- Requires authentication
- Verifies user has permission
- Service role access for auth deletion

---

## Subscription Management Functions

### 7. upgrade-subscription-plan

**Purpose**: Handles subscription plan upgrades

**Path**: `supabase/functions/upgrade-subscription-plan/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "organizationId": "uuid",
  "newMaxManagers": 10,
  "newMaxWorkers": 50,
  "planType": "professional"
}
```

**Plan Types**:
- `trial`: 3 managers, 10 workers (14 days)
- `basic`: 5 managers, 25 workers
- `professional`: 10 managers, 50 workers
- `enterprise`: Unlimited

**Response Success**:
```json
{
  "success": true,
  "subscriptionId": "new-uuid",
  "subscription": { ...details... },
  "message": "Successfully upgraded to professional plan"
}
```

**What It Does**:
1. Verifies user can manage organization
2. Ends current active subscription
3. Creates new subscription record
4. Updates organization limits
5. Returns new subscription details

**Security**:
- Requires super admin authentication
- Verifies organization ownership
- Validates plan limits

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('upgrade-subscription-plan', {
  body: {
    organizationId: 'uuid',
    newMaxManagers: 10,
    newMaxWorkers: 50,
    planType: 'professional'
  }
});
```

---

### 8. reconcile-subscription

**Purpose**: Syncs actual manager/worker counts with subscription records

**Path**: `supabase/functions/reconcile-subscription/index.ts`

**JWT Required**: ✅ YES

**Required Secrets**: None

**Request Body**:
```json
{
  "organizationId": "uuid"
}
```

**Response Success**:
```json
{
  "success": true,
  "currentManagers": 5,
  "currentWorkers": 23,
  "message": "Subscription counts updated"
}
```

**When to Use**:
- After adding/removing managers or workers
- During billing cycle
- To verify subscription accuracy

---

## Notification Functions

### 9. send-amendment-notification

**Purpose**: Notifies workers when time amendment is approved/rejected

**Path**: `supabase/functions/send-amendment-notification/index.ts`

**JWT Required**: ❌ NO (Called by database triggers)

**Required Secrets**:
- `RESEND_API_KEY` (if email notifications enabled)
- `FROM_EMAIL` (if email notifications enabled)

**Request Body**:
```json
{
  "worker_id": "uuid",
  "amendment_id": "uuid",
  "status": "approved",
  "manager_name": "Jane Smith",
  "requested_clock_in": "2024-01-15T09:00:00Z",
  "requested_clock_out": "2024-01-15T17:00:00Z",
  "manager_notes": "Approved as requested"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Notification sent"
}
```

**What It Does**:
1. Gets worker details from database
2. Formats notification message based on status
3. Creates in-app notification record
4. Sends push notification (if token exists)
5. Sends email (if email notifications enabled)

**Notification Format**:
- **Approved**: "✅ Time Amendment Approved - Your time amendment request was approved by Jane Smith."
- **Rejected**: "❌ Time Amendment Rejected - Your time amendment request was rejected by Jane Smith."

**How It's Called**:
- Typically triggered by database trigger when amendment status changes
- Can also be called manually from manager interface

---

### 10. send-demo-request

**Purpose**: Sends demo request emails from landing page to sales team

**Path**: `supabase/functions/send-demo-request/index.ts`

**JWT Required**: ❌ NO (Public function for landing page)

**Required Secrets**:
- `RESEND_API_KEY` ✅ Required
- `FROM_EMAIL` ✅ Required
- `TO_EMAIL` ✅ Required

**Request Body**:
```json
{
  "name": "John Smith",
  "email": "john@company.com",
  "company": "Acme Construction",
  "phone": "+44 20 1234 5678",
  "message": "Interested in demo for 20 workers"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Demo request sent successfully"
}
```

**What It Does**:
1. Validates input data
2. Stores demo request in database
3. Formats email with request details
4. Sends email to TO_EMAIL address using Resend
5. Returns success/error response

**Email Template**:
```
Subject: New Demo Request from [Company Name]

Name: [name]
Email: [email]
Company: [company]
Phone: [phone]

Message:
[message]
```

**Security**:
- Rate limiting to prevent spam
- Input validation
- Sanitizes user input
- Public access (no auth required)

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('send-demo-request', {
  body: {
    name: 'John Smith',
    email: 'john@company.com',
    company: 'Acme Construction',
    phone: '+44 20 1234 5678',
    message: 'Interested in demo'
  }
});
```

---

## Data Integration Functions

### 11. geocode-postcode

**Purpose**: Converts UK postcodes to GPS coordinates using Google Geocoding API

**Path**: `supabase/functions/geocode-postcode/index.ts`

**JWT Required**: ❌ NO (Used during job creation)

**Required Secrets**:
- `GOOGLE_GEOCODING_API_KEY` ✅ Required

**Request Body**:
```json
{
  "postcode": "SW1A 1AA"
}
```

**Response Success**:
```json
{
  "success": true,
  "latitude": 51.5014,
  "longitude": -0.1419,
  "formatted_address": "Westminster, London SW1A 1AA, UK"
}
```

**Response Error**:
```json
{
  "error": "Invalid postcode or geocoding failed"
}
```

**What It Does**:
1. Validates postcode format
2. Checks local cache (`uk_postcodes` table)
3. If not cached, calls Google Geocoding API
4. Stores result in cache for future use
5. Returns coordinates

**Performance Optimization**:
- Caches all geocoded postcodes
- Reduces API calls by 95%+
- Typical response time: <50ms (cached), ~200ms (API call)

**Cost Optimization**:
- Free for cached postcodes
- Only charges for new postcodes
- ~$0.005 per new postcode

**How to Call**:
```typescript
const { data, error } = await supabase.functions.invoke('geocode-postcode', {
  body: { postcode: 'SW1A 1AA' }
});

if (data?.success) {
  const { latitude, longitude } = data;
  // Use coordinates...
}
```

**UK Postcode Format**:
- Supports all UK postcode formats
- Examples: SW1A 1AA, M1 1AE, B33 8TH
- Automatically normalizes format (removes extra spaces)

---

### 12. import-uk-postcodes

**Purpose**: Bulk imports UK postcode data for offline geocoding

**Path**: `supabase/functions/import-uk-postcodes/index.ts`

**JWT Required**: ✅ YES (Admin only)

**Required Secrets**: None

**Request Body**:
```json
{
  "postcodes": [
    { "postcode": "SW1A 1AA", "latitude": 51.5014, "longitude": -0.1419 },
    { "postcode": "M1 1AE", "latitude": 53.4808, "longitude": -2.2426 }
  ]
}
```

**Response Success**:
```json
{
  "success": true,
  "imported": 2,
  "skipped": 0,
  "message": "Successfully imported 2 postcodes"
}
```

**What It Does**:
1. Validates postcode data format
2. Bulk inserts into `uk_postcodes` table
3. Skips duplicates
4. Returns import statistics

**Use Cases**:
- Pre-populate database with common postcodes
- Import from CSV file
- Reduce API calls for new organizations

**Performance**:
- Can import 1000+ postcodes in single request
- Atomic transaction (all or nothing)
- Duplicate detection prevents errors

---

## Function Configuration

All functions are configured in `supabase/config.toml`:

```toml
[functions.setup-organization]
verify_jwt = false  # Public function for signup

[functions.send-demo-request]
verify_jwt = false  # Public function for landing page

[functions.geocode-postcode]
verify_jwt = false  # Used during job creation

[functions.send-amendment-notification]
verify_jwt = false  # Called by triggers

# All other functions require JWT
[functions.manager-change-password]
verify_jwt = true

[functions.delete-organization]
verify_jwt = true

# ... etc
```

---

## Common Patterns

### Calling Authenticated Functions
```typescript
// Requires user to be logged in
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... }
  // Authorization header automatically included by Supabase client
});
```

### Calling Public Functions
```typescript
// Can be called without authentication
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... }
});
```

### Error Handling
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... }
});

if (error) {
  console.error('Function error:', error);
  // Handle error (show toast, log, etc.)
  return;
}

if (!data.success) {
  console.error('Function returned error:', data.error);
  // Handle business logic error
  return;
}

// Success!
console.log('Success:', data);
```

---

## Testing Edge Functions

### Using Supabase Dashboard
1. Go to Edge Functions in Supabase dashboard
2. Click on function name
3. Click "Test" tab
4. Enter request body
5. Click "Send Request"
6. View response and logs

### Using curl
```bash
# Authenticated function
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/function-name \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Public function
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/function-name \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Using Postman
1. Create new request
2. Method: POST
3. URL: `https://[PROJECT_REF].supabase.co/functions/v1/function-name`
4. Headers:
   - `Authorization: Bearer YOUR_JWT_TOKEN` (if required)
   - `Content-Type: application/json`
5. Body: JSON payload
6. Send and view response

---

## Monitoring and Debugging

### View Logs
1. Supabase Dashboard > Edge Functions
2. Click function name
3. View "Logs" tab
4. Filter by time period
5. Search for errors or specific requests

### Common Log Messages
```
[SETUP-ORGANIZATION] Function started
[SETUP-ORGANIZATION] Request data parsed
[SETUP-ORGANIZATION] Organization created
[AMENDMENT-NOTIFICATION] Processing: {...}
[AMENDMENT-NOTIFICATION] In-app notification created
```

### Debugging Tips
- Add `console.log()` statements in function code
- Check function logs in Supabase dashboard
- Verify secrets are configured correctly
- Test with Postman before integrating in app
- Check CORS headers if calling from web app
- Verify JWT token is valid and not expired

---

## Performance Optimization

### Best Practices
1. **Cache API responses** (like geocoding does)
2. **Batch operations** where possible
3. **Use database functions** for complex queries
4. **Minimize API calls** to external services
5. **Set appropriate timeouts**
6. **Use connection pooling**

### Typical Response Times
- Authentication functions: 100-300ms
- Database operations: 50-200ms
- External API calls: 200-1000ms
- Geocoding (cached): 50ms
- Geocoding (API call): 200-300ms
- Email sending: 500-1000ms

---

## Security Checklist

- [ ] All sensitive functions require JWT authentication
- [ ] Service role key never exposed in frontend
- [ ] Input validation on all functions
- [ ] RLS policies enforce data access control
- [ ] Secrets stored in Supabase (not in code)
- [ ] CORS configured for production domains
- [ ] Rate limiting on public functions
- [ ] Audit logging for sensitive operations
- [ ] Error messages don't leak sensitive info
- [ ] SQL injection prevention (use parameterized queries)

---

## Deployment

### Automatic Deployment (CI/CD)
- Edge functions automatically deployed when code changes
- Managed by CI/CD CI/CD pipeline
- No manual deployment needed
- Config changes reflected on next build

### Manual Deployment (if needed)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy specific function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy
```

---

## Troubleshooting Guide

### Function Not Found (404)
- Check function is deployed
- Verify function name in URL matches folder name
- Check config.toml has function listed

### Unauthorized (401)
- Verify JWT token is valid
- Check user is authenticated
- Verify function requires JWT in config.toml

### Forbidden (403)
- Check RLS policies allow access
- Verify user has correct role
- Check function permissions

### Internal Server Error (500)
- View function logs for error details
- Check required secrets are configured
- Verify external API keys are valid
- Check for syntax errors in function code

### CORS Error
- Add ALLOWED_ORIGINS secret
- Check CORS headers in function
- Verify domain matches origin

### Timeout Error
- Check function isn't taking too long
- Optimize database queries
- Check external API response times
- Consider increasing timeout (default 30s)

---

## Migration Checklist

When migrating edge functions to new project:

- [ ] All 12 functions exist in `supabase/functions/` directory
- [ ] `supabase/config.toml` updated with new project_id
- [ ] All function configurations preserved in config.toml
- [ ] All required secrets configured in new project
- [ ] Functions deployed successfully
- [ ] Each function tested individually
- [ ] Logs monitored for errors
- [ ] Performance metrics similar to old project

---

## Support Resources

- **Supabase Edge Functions Docs**: https://supabase.com/docs/guides/functions
- **Deno Documentation**: https://deno.land/manual
- **Google Geocoding API**: https://developers.google.com/maps/documentation/geocoding
- **Resend API**: https://resend.com/docs

---

## Function Dependency Graph

```
Landing Page
  └─> send-demo-request (Public)
       └─> Resend API

Organization Setup
  └─> setup-organization (Public)
       └─> Creates org, super admin

Job Creation
  └─> geocode-postcode (Public)
       └─> Google Geocoding API
       └─> uk_postcodes table (cache)

Time Amendment
  └─> send-amendment-notification (Public)
       └─> Resend API (optional)
       └─> notifications table

Manager Actions
  └─> manager-change-password (Auth)
  └─> upgrade-subscription-plan (Auth)
  └─> delete-organization (Auth)
  └─> delete-user (Auth)

Profile Updates
  └─> secure-profile-operations (Auth)
```

---

**Document Version**: 1.0  
**Last Updated**: Migration creation  
**Maintained By**: Development team

