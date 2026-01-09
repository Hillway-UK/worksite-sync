# Database Migration Checklist

Complete step-by-step guide for migrating your Worksite Sync database to a new Supabase project.

**Estimated Time**: 1-2 hours  
**Difficulty**: Moderate  
**Prerequisites**: Access to both old and new Supabase projects, CI/CD project access

---

## Phase 1: Pre-Migration Preparation

### 1.1 Create New Supabase Project
- [ ] Go to [supabase.com](https://supabase.com)
- [ ] Click "New Project"
- [ ] Choose your organization
- [ ] Enter project details:
  - Project name: `worksite-sync-production` (or your preferred name)
  - Database password: **Save this securely!**
  - Region: Choose closest to your users
  - Pricing plan: Select appropriate plan
- [ ] Wait for project provisioning (2-3 minutes)
- [ ] **Save your project credentials:**
  ```
  Project URL: https://[PROJECT_REF].supabase.co
  Anon (public) key: [LONG_KEY_STRING]
  Service role key: [LONG_KEY_STRING] - KEEP SECRET!
  Project ID: [PROJECT_REF]
  ```

### 1.2 Document Current Configuration
- [ ] Open your old Supabase project
- [ ] Go to Settings > API
- [ ] Note down all current environment variables
- [ ] Go to Storage and note any custom bucket configurations
- [ ] Check Database > Extensions to see which extensions are enabled

### 1.3 Backup Current Database (Optional but Recommended)
- [ ] In old Supabase project, go to Database
- [ ] Click "Backups" or use the SQL Editor
- [ ] Run: `pg_dump` command or use Supabase dashboard export
- [ ] Save backup file securely

---

## Phase 2: Database Migration

### 2.1 Run Master Migration Script
- [ ] Open your new Supabase project
- [ ] Navigate to SQL Editor
- [ ] Copy entire contents of `MASTER_MIGRATION.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run" or press Cmd/Ctrl + Enter
- [ ] **Wait for completion** (2-5 minutes)
- [ ] Check for any errors in the results panel
  - If errors occur, note the line number and error message
  - Common issues: Extension conflicts (safe to ignore if extension already exists)

### 2.2 Verify Table Creation
- [ ] Go to Database > Tables in new project
- [ ] Confirm these tables exist:
  - [ ] organizations
  - [ ] user_roles
  - [ ] super_admins
  - [ ] managers
  - [ ] workers
  - [ ] jobs
  - [ ] job_assignments
  - [ ] time_entries
  - [ ] time_amendments
  - [ ] expense_types
  - [ ] additional_costs
  - [ ] photos
  - [ ] demo_requests
  - [ ] subscription_usage
  - [ ] uk_postcodes
  - [ ] notifications
  - [ ] notification_preferences
  - [ ] tutorial_completion

### 2.3 Verify Functions
- [ ] Go to Database > Functions
- [ ] Confirm these functions exist:
  - [ ] has_role
  - [ ] is_manager
  - [ ] is_super_admin
  - [ ] get_user_organization_id
  - [ ] can_manage_organization
  - [ ] get_clocked_in_workers
  - [ ] get_total_hours_today
  - [ ] get_worker_weekly_hours
  - [ ] get_recent_activity
  - [ ] upgrade_subscription_plan
  - [ ] handle_updated_at
  - [ ] calculate_total_hours

### 2.4 Verify RLS Policies
- [ ] For each table, click on it in Database > Tables
- [ ] Click "Policies" tab
- [ ] Confirm RLS is enabled (shield icon should be visible)
- [ ] Verify policies are present for each table
- [ ] Critical tables to check:
  - [ ] organizations - Should have super admin policies
  - [ ] workers - Should have worker + manager + super admin policies
  - [ ] time_entries - Should have worker + manager + super admin policies
  - [ ] managers - Should have manager + super admin policies

### 2.5 Create Storage Bucket
- [ ] Go to Storage in new Supabase project
- [ ] Click "Create bucket"
- [ ] Bucket name: `worker-photos`
- [ ] Public bucket: **Yes** (checked)
- [ ] Click "Create bucket"
- [ ] Click on `worker-photos` bucket
- [ ] Go to Policies tab
- [ ] Verify these policies exist (if not, re-run the storage section of migration):
  - [ ] Workers can upload their photos
  - [ ] Anyone can view photos
  - [ ] Workers can delete their photos

---

## Phase 3: Secrets Transfer

### 3.1 Access Secrets Management
- [ ] In new Supabase project, go to Settings > Edge Functions
- [ ] Scroll to "Secrets" section
- [ ] Prepare to add each secret (see SECRETS_INVENTORY.md for details)

### 3.2 Transfer Required Secrets

#### Google Geocoding API Key
- [ ] Get key from old project or Google Cloud Console
- [ ] In new project secrets, add:
  - Name: `GOOGLE_GEOCODING_API_KEY`
  - Value: `[YOUR_KEY]`
- [ ] Click "Save"

#### Resend API Key (for emails)
- [ ] Get key from old project or [resend.com](https://resend.com)
- [ ] In new project secrets, add:
  - Name: `RESEND_API_KEY`
  - Value: `[YOUR_KEY]`
- [ ] Click "Save"

#### Email Configuration
- [ ] Add FROM_EMAIL:
  - Name: `FROM_EMAIL`
  - Value: `noreply@yourdomain.com` (or your verified sender)
- [ ] Add TO_EMAIL:
  - Name: `TO_EMAIL`
  - Value: `admin@yourdomain.com` (for demo requests)

#### Optional Configuration
- [ ] Add ALLOWED_ORIGINS (if using CORS):
  - Name: `ALLOWED_ORIGINS`
  - Value: `https://yourdomain.com,https://www.yourdomain.com`
- [ ] Add SITE_URL:
  - Name: `SITE_URL`
  - Value: `https://yourdomain.com`

### 3.3 Verify Secrets
- [ ] In Secrets section, confirm all required secrets are listed
- [ ] Each secret should show "Last updated: [timestamp]"
- [ ] **Do not share these secrets or commit them to git**

---

## Phase 4: Edge Functions Deployment

### 4.1 Update Supabase Config
- [ ] In your CI/CD project, locate `supabase/config.toml`
- [ ] Update the first line with your new project ID:
  ```toml
  project_id = "YOUR_NEW_PROJECT_ID"
  ```
- [ ] Verify all edge function configurations are present
- [ ] Save the file

### 4.2 Automatic Deployment
- [ ] Edge functions will be automatically deployed by CI/CD
- [ ] Wait for deployment to complete (visible in CI/CD console)
- [ ] Check Supabase dashboard > Edge Functions to verify all 12 functions deployed:
  - [ ] delete-organization
  - [ ] delete-user
  - [ ] geocode-postcode
  - [ ] import-uk-postcodes
  - [ ] manager-change-password
  - [ ] reconcile-subscription
  - [ ] reset-manager-password
  - [ ] secure-profile-operations
  - [ ] send-amendment-notification
  - [ ] send-demo-request
  - [ ] setup-organization
  - [ ] upgrade-subscription-plan

### 4.3 Verify Edge Function Configuration
- [ ] In Supabase dashboard, click on each edge function
- [ ] Verify JWT verification settings match your requirements
- [ ] Functions with `verify_jwt = false` (public functions):
  - [ ] setup-organization
  - [ ] send-demo-request
  - [ ] send-amendment-notification
  - [ ] geocode-postcode
- [ ] All other functions should have JWT verification enabled

---

## Phase 5: Frontend Configuration

### 5.1 Update CI/CD Project Environment Variables
- [ ] Open your CI/CD project
- [ ] Go to Project Settings (or Environment Variables section)
- [ ] Update these variables:
  - [ ] `VITE_SUPABASE_URL`: Your new project URL
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`: Your new anon key
- [ ] Save changes
- [ ] **Rebuild your project** to apply new environment variables

### 5.2 Verify Client Configuration
- [ ] Open `src/integrations/supabase/client.ts` in your project
- [ ] Confirm it's reading from environment variables (should already be correct)
- [ ] No code changes needed if using `env.VITE_SUPABASE_URL` and `env.VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Phase 6: Testing

### 6.1 Authentication Testing
- [ ] Open your application
- [ ] Test signup flow:
  - [ ] Create new super admin account
  - [ ] Check if user appears in `auth.users` table
  - [ ] Check if super admin record created in `super_admins` table
  - [ ] Verify organization created
- [ ] Test login flow:
  - [ ] Login with super admin credentials
  - [ ] Verify JWT token is generated
  - [ ] Check browser console for any auth errors
- [ ] Test logout flow:
  - [ ] Logout
  - [ ] Verify session cleared
  - [ ] Verify redirect to login page

### 6.2 Super Admin Operations Testing
- [ ] Login as super admin
- [ ] Test dashboard access
- [ ] Test creating a manager:
  - [ ] Fill in manager details
  - [ ] Submit form
  - [ ] Verify manager appears in list
  - [ ] Check `managers` table in database
- [ ] Test creating a worker:
  - [ ] Fill in worker details
  - [ ] Submit form
  - [ ] Verify worker appears in list
  - [ ] Check `workers` table in database
- [ ] Test creating a job:
  - [ ] Fill in job details including address/postcode
  - [ ] Submit form
  - [ ] Verify job appears in list
  - [ ] Check if geocoding worked (latitude/longitude populated)
- [ ] Test creating expense types:
  - [ ] Add new expense type
  - [ ] Verify it appears in dropdown when creating costs
- [ ] Test organization settings:
  - [ ] Update organization details
  - [ ] Upload logo
  - [ ] Verify changes saved

### 6.3 Manager Operations Testing
- [ ] Login as a manager (use manager credentials)
- [ ] Test viewing workers assigned to manager
- [ ] Test viewing time entries
- [ ] Test time amendment approval:
  - [ ] Find pending amendment
  - [ ] Approve or reject
  - [ ] Verify status changes
  - [ ] Check if notification sent to worker
- [ ] Test reports generation
- [ ] Test job assignment

### 6.4 Worker Operations Testing
- [ ] Login as a worker
- [ ] Test clock in:
  - [ ] Select job
  - [ ] Allow location access
  - [ ] Clock in
  - [ ] Verify time entry created
  - [ ] Check location recorded
- [ ] Test clock out:
  - [ ] Clock out from active entry
  - [ ] Verify total hours calculated
  - [ ] Check location recorded
- [ ] Test time amendment request:
  - [ ] Select time entry
  - [ ] Request amendment
  - [ ] Provide reason
  - [ ] Submit
  - [ ] Verify amendment status is "pending"
- [ ] Test photo upload:
  - [ ] Upload photo to time entry
  - [ ] Verify photo appears
  - [ ] Check storage bucket has photo
- [ ] Test additional costs:
  - [ ] Add expense to time entry
  - [ ] Select expense type
  - [ ] Enter amount
  - [ ] Verify cost saved

### 6.5 Edge Functions Testing
- [ ] Test geocoding:
  - [ ] Create job with UK postcode
  - [ ] Verify latitude/longitude populated
  - [ ] Check edge function logs
- [ ] Test email sending:
  - [ ] Submit demo request from landing page
  - [ ] Check if email received at TO_EMAIL address
  - [ ] Check edge function logs
- [ ] Test amendment notifications:
  - [ ] Approve/reject an amendment as manager
  - [ ] Verify notification created in `notifications` table
  - [ ] Login as worker and check notification appears
- [ ] Test password change:
  - [ ] As manager, change password
  - [ ] Logout and login with new password
  - [ ] Verify successful login

### 6.6 Storage Testing
- [ ] Test photo upload:
  - [ ] Upload worker photo
  - [ ] Verify appears in UI
  - [ ] Check Supabase Storage browser
  - [ ] Verify file exists in `worker-photos` bucket
- [ ] Test photo viewing:
  - [ ] View uploaded photo
  - [ ] Verify public URL works
  - [ ] Test viewing from different user accounts
- [ ] Test photo deletion:
  - [ ] Delete a photo
  - [ ] Verify removed from UI
  - [ ] Check removed from storage bucket

### 6.7 RLS Policy Testing
- [ ] Verify users can only see their own data:
  - [ ] Login as Worker A
  - [ ] Try to access Worker B's time entries via direct URL
  - [ ] Should be denied/empty
- [ ] Verify managers can see organization data:
  - [ ] Login as manager
  - [ ] Verify can see all workers in organization
  - [ ] Verify can see all time entries for organization
- [ ] Verify super admins have full access:
  - [ ] Login as super admin
  - [ ] Verify can see all organization data
  - [ ] Verify can modify any record in organization

### 6.8 Error Handling Testing
- [ ] Test invalid input:
  - [ ] Try creating worker without email
  - [ ] Try creating job without address
  - [ ] Verify proper error messages shown
- [ ] Test network errors:
  - [ ] Disconnect internet
  - [ ] Try an operation
  - [ ] Verify graceful error handling
  - [ ] Reconnect and verify retry works
- [ ] Test permission errors:
  - [ ] Try accessing admin page as worker
  - [ ] Verify redirect to appropriate page
- [ ] Check browser console for any errors
- [ ] Check Supabase logs for any database errors

---

## Phase 7: Data Migration (If Needed)

**Note**: This phase is only needed if you have existing data in your old database.

### 7.1 Export Data from Old Database
- [ ] Open old Supabase project
- [ ] Go to Database > Migrations
- [ ] Or use SQL Editor to export data:
  ```sql
  -- Export organizations
  SELECT * FROM organizations;
  -- Export super_admins
  SELECT * FROM super_admins;
  -- Export managers
  SELECT * FROM managers;
  -- Export workers
  SELECT * FROM workers;
  -- Continue for all tables...
  ```
- [ ] Save results as CSV or JSON
- [ ] Alternatively, use `pg_dump` for complete backup

### 7.2 Import Data to New Database
- [ ] **IMPORTANT**: Import in this order to respect foreign key relationships:
  1. [ ] organizations
  2. [ ] super_admins
  3. [ ] managers
  4. [ ] workers
  5. [ ] jobs
  6. [ ] job_assignments
  7. [ ] expense_types
  8. [ ] time_entries
  9. [ ] time_amendments
  10. [ ] additional_costs
  11. [ ] photos
  12. [ ] notifications
  13. [ ] notification_preferences
  14. [ ] subscription_usage
  15. [ ] uk_postcodes (if you have custom data)

### 7.3 Import Methods

#### Option A: Using Supabase Dashboard
- [ ] Go to Database > Tables
- [ ] Click on table name
- [ ] Click "Insert" > "Import data"
- [ ] Upload CSV file
- [ ] Map columns
- [ ] Import

#### Option B: Using SQL INSERT statements
- [ ] Open SQL Editor
- [ ] Prepare INSERT statements with your data:
  ```sql
  INSERT INTO organizations (id, name, email, ...)
  VALUES 
    ('uuid1', 'Company 1', 'email1@example.com', ...),
    ('uuid2', 'Company 2', 'email2@example.com', ...);
  ```
- [ ] Run statements

#### Option C: Using `psql` or database client
- [ ] Connect to new database using connection string
- [ ] Run: `psql "postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"`
- [ ] Copy data using `COPY` command or import from file

### 7.4 Verify Data Integrity
- [ ] Check row counts match:
  ```sql
  -- Run in both old and new databases
  SELECT 
    'organizations' as table_name, COUNT(*) as count FROM organizations
  UNION ALL
  SELECT 'super_admins', COUNT(*) FROM super_admins
  UNION ALL
  SELECT 'managers', COUNT(*) FROM managers
  UNION ALL
  SELECT 'workers', COUNT(*) FROM workers
  UNION ALL
  SELECT 'time_entries', COUNT(*) FROM time_entries;
  ```
- [ ] Verify foreign key relationships intact
- [ ] Spot check random records
- [ ] Test login with existing user accounts
- [ ] Verify time entries show correct workers and jobs
- [ ] Check that organization relationships are maintained

### 7.5 Migrate auth.users
- [ ] **IMPORTANT**: User passwords cannot be exported/imported directly
- [ ] Options:
  1. **Force password reset** for all users (recommended):
     - [ ] Send password reset emails to all users
     - [ ] Users set new passwords on first login
  2. **Manual user creation**:
     - [ ] Users re-register with same email
     - [ ] You link to existing data records
  3. **Supabase support** (for large migrations):
     - [ ] Contact Supabase support for migration assistance

### 7.6 Migrate Storage Files
- [ ] Export files from old `worker-photos` bucket:
  - [ ] Go to Storage > worker-photos in old project
  - [ ] Download all files (or use Supabase CLI)
- [ ] Import files to new `worker-photos` bucket:
  - [ ] Go to Storage > worker-photos in new project
  - [ ] Upload files maintaining folder structure
  - [ ] Verify file paths match records in `photos` table

---

## Phase 8: Go-Live

### 8.1 Final Verification
- [ ] Run smoke tests on all critical features
- [ ] Verify no console errors in browser
- [ ] Check Supabase dashboard for any error logs
- [ ] Test with multiple user roles simultaneously
- [ ] Verify real-time updates work (if applicable)
- [ ] Test mobile responsiveness
- [ ] Verify email notifications deliver correctly

### 8.2 Monitor Closely
- [ ] **First 24 hours**: Check logs every few hours
- [ ] Monitor Supabase dashboard > Logs
- [ ] Monitor browser console in production
- [ ] Watch for any user-reported issues
- [ ] Have rollback plan ready (keep old database accessible)

### 8.3 Update DNS/Environment (if applicable)
- [ ] If using custom domain, update DNS records
- [ ] Update any third-party service webhooks
- [ ] Update any external integrations
- [ ] Notify team of new database URL

### 8.4 Backup Strategy
- [ ] Set up automatic backups in new Supabase project:
  - [ ] Go to Settings > Database > Backups
  - [ ] Configure backup schedule
  - [ ] Enable point-in-time recovery (paid plans)
- [ ] Keep old database active for 30 days as backup
- [ ] Document rollback procedure

---

## Phase 9: Cleanup (After 30 Days)

### 9.1 Verify Stability
- [ ] Confirm no critical issues for 30 days
- [ ] Verify all features working correctly
- [ ] Confirm users not reporting data issues
- [ ] Verify backups are running successfully

### 9.2 Decommission Old Database (Optional)
- [ ] Export final backup of old database
- [ ] Store backup securely
- [ ] Pause or delete old Supabase project
- [ ] Update documentation with new project details
- [ ] Remove old project credentials from team access

---

## Troubleshooting Common Issues

### Issue: Migration SQL fails with "already exists" errors
**Solution**: This is usually safe to ignore. The IF NOT EXISTS clauses handle this, but some objects may have been created already.

### Issue: RLS policies not working
**Solution**: 
- Verify RLS is enabled on table
- Check policy conditions match your auth setup
- Test with `SELECT * FROM table_name` in SQL Editor (will show RLS errors)
- Verify user_id matches auth.uid() in policies

### Issue: Edge functions not deploying
**Solution**:
- Check config.toml has correct project_id
- Verify all required secrets are set
- Check edge function logs in Supabase dashboard
- Redeploy from CI/CD

### Issue: Storage uploads failing
**Solution**:
- Verify bucket exists and is public
- Check storage policies are created
- Verify bucket name matches code (`worker-photos`)
- Check file size limits

### Issue: Authentication not working
**Solution**:
- Verify environment variables updated in CI/CD
- Clear browser cache and localStorage
- Check auth configuration in Supabase
- Verify JWT expiry settings

### Issue: Can't access old data after migration
**Solution**:
- Check UUIDs maintained during data import
- Verify foreign key relationships intact
- Check RLS policies allow access to imported data
- Verify organization_id matches across related tables

---

## Success Criteria

✅ All tables created successfully  
✅ All RLS policies active and working  
✅ All edge functions deployed and functional  
✅ All secrets configured correctly  
✅ Authentication flow works end-to-end  
✅ All user roles can access appropriate data  
✅ Storage uploads and downloads work  
✅ Geocoding functionality works  
✅ Email notifications deliver  
✅ No errors in browser console  
✅ No errors in Supabase logs  
✅ Data integrity verified (if data was migrated)  

---

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **CI/CD Docs**: YOUR_PLATFORM_URL
- **This Project's Edge Functions**: See EDGE_FUNCTIONS_GUIDE.md
- **Secrets Documentation**: See SECRETS_INVENTORY.md

---

## Migration Completion

**Migration Started**: ________________  
**Migration Completed**: ________________  
**Verified By**: ________________  
**Any Issues Encountered**: ________________

**Old Project ID**: ________________  
**New Project ID**: ________________  

Keep this checklist for your records and reference.

