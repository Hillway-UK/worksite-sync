-- ============================================================================
-- WORKSITE SYNC - DATABASE VERIFICATION SCRIPT
-- ============================================================================
-- Run this script in your Supabase SQL Editor to verify all database objects
-- are properly configured in your new project.
--
-- This script will:
-- 1. Check for all required extensions, enums, tables, indexes, functions
-- 2. Verify RLS policies are enabled
-- 3. Check storage bucket configuration
-- 4. Generate a comprehensive report with ✅/❌ indicators
-- 5. Provide SQL commands to fix any missing objects
-- ============================================================================

DO $$ 
DECLARE
    v_result TEXT := E'\n\n';
    v_count INT;
    v_total_checks INT := 0;
    v_passed_checks INT := 0;
    v_missing TEXT := '';
BEGIN
    v_result := v_result || E'╔════════════════════════════════════════════════════════════════════╗\n';
    v_result := v_result || E'║         WORKSITE SYNC DATABASE VERIFICATION REPORT                 ║\n';
    v_result := v_result || E'╚════════════════════════════════════════════════════════════════════╝\n\n';

    -- ========================================================================
    -- 1. CHECK EXTENSIONS
    -- ========================================================================
    v_result := v_result || E'\n📦 EXTENSIONS\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    -- uuid-ossp
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count FROM pg_extension WHERE extname = 'uuid-ossp';
    IF v_count > 0 THEN
        v_result := v_result || E'✅ uuid-ossp extension is enabled\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ uuid-ossp extension is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Enable uuid-ossp extension\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
    END IF;

    -- pgcrypto
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count FROM pg_extension WHERE extname = 'pgcrypto';
    IF v_count > 0 THEN
        v_result := v_result || E'✅ pgcrypto extension is enabled\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ pgcrypto extension is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Enable pgcrypto extension\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n';
    END IF;

    -- ========================================================================
    -- 2. CHECK ENUMS
    -- ========================================================================
    v_result := v_result || E'\n\n📋 CUSTOM TYPES (ENUMS)\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    -- app_role
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count FROM pg_type WHERE typname = 'app_role';
    IF v_count > 0 THEN
        v_result := v_result || E'✅ app_role enum exists (admin, moderator, user)\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ app_role enum is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Create app_role enum\nCREATE TYPE public.app_role AS ENUM (\'admin\', \'moderator\', \'user\');\n';
    END IF;

    -- subscription_plan
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count FROM pg_type WHERE typname = 'subscription_plan';
    IF v_count > 0 THEN
        v_result := v_result || E'✅ subscription_plan enum exists (trial, basic, professional, enterprise)\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ subscription_plan enum is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Create subscription_plan enum\nCREATE TYPE public.subscription_plan AS ENUM (\'trial\', \'basic\', \'professional\', \'enterprise\');\n';
    END IF;

    -- amendment_status
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count FROM pg_type WHERE typname = 'amendment_status';
    IF v_count > 0 THEN
        v_result := v_result || E'✅ amendment_status enum exists (pending, approved, rejected)\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ amendment_status enum is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Create amendment_status enum\nCREATE TYPE public.amendment_status AS ENUM (\'pending\', \'approved\', \'rejected\');\n';
    END IF;

    -- ========================================================================
    -- 3. CHECK TABLES
    -- ========================================================================
    v_result := v_result || E'\n\n🗂️  TABLES (19 required)\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    DECLARE
        table_names TEXT[] := ARRAY[
            'organizations', 'user_roles', 'super_admins', 'managers', 'workers',
            'jobs', 'job_assignments', 'time_entries', 'time_amendments',
            'expense_types', 'additional_costs', 'photos', 'demo_requests',
            'subscription_usage', 'uk_postcodes', 'notifications',
            'notification_preferences', 'tutorial_completion', 'subscription_audit_log'
        ];
        table_name TEXT;
    BEGIN
        FOREACH table_name IN ARRAY table_names
        LOOP
            v_total_checks := v_total_checks + 1;
            SELECT COUNT(*) INTO v_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name;
            
            IF v_count > 0 THEN
                v_result := v_result || '✅ ' || table_name || E'\n';
                v_passed_checks := v_passed_checks + 1;
            ELSE
                v_result := v_result || '❌ ' || table_name || E' is MISSING\n';
                v_missing := v_missing || E'\n-- Fix: Table "' || table_name || '" is missing. Run MASTER_MIGRATION.sql\n';
            END IF;
        END LOOP;
    END;

    -- ========================================================================
    -- 4. CHECK INDEXES
    -- ========================================================================
    v_result := v_result || E'\n\n⚡ PERFORMANCE INDEXES (11 required)\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    DECLARE
        index_names TEXT[] := ARRAY[
            'idx_workers_organization', 'idx_workers_manager', 'idx_jobs_organization',
            'idx_time_entries_worker', 'idx_time_entries_job', 'idx_time_entries_clock_in',
            'idx_time_amendments_worker', 'idx_time_amendments_status',
            'idx_notifications_worker', 'idx_notifications_read', 'idx_uk_postcodes_postcode'
        ];
        index_name TEXT;
    BEGIN
        FOREACH index_name IN ARRAY index_names
        LOOP
            v_total_checks := v_total_checks + 1;
            SELECT COUNT(*) INTO v_count 
            FROM pg_indexes 
            WHERE schemaname = 'public' AND indexname = index_name;
            
            IF v_count > 0 THEN
                v_result := v_result || '✅ ' || index_name || E'\n';
                v_passed_checks := v_passed_checks + 1;
            ELSE
                v_result := v_result || '❌ ' || index_name || E' is MISSING\n';
                v_missing := v_missing || E'\n-- Fix: Index "' || index_name || '" is missing. Run MASTER_MIGRATION.sql\n';
            END IF;
        END LOOP;
    END;

    -- ========================================================================
    -- 5. CHECK FUNCTIONS
    -- ========================================================================
    v_result := v_result || E'\n\n⚙️  DATABASE FUNCTIONS (10 required)\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    DECLARE
        function_names TEXT[] := ARRAY[
            'has_role', 'is_manager', 'is_super_admin', 'get_user_organization_id',
            'can_manage_organization', 'get_clocked_in_workers', 'get_total_hours_today',
            'get_worker_weekly_hours', 'get_recent_activity', 'upgrade_subscription_plan'
        ];
        function_name TEXT;
    BEGIN
        FOREACH function_name IN ARRAY function_names
        LOOP
            v_total_checks := v_total_checks + 1;
            SELECT COUNT(*) INTO v_count 
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = function_name;
            
            IF v_count > 0 THEN
                v_result := v_result || '✅ ' || function_name || '()\n';
                v_passed_checks := v_passed_checks + 1;
            ELSE
                v_result := v_result || '❌ ' || function_name || E'() is MISSING\n';
                v_missing := v_missing || E'\n-- Fix: Function "' || function_name || '" is missing. Run MASTER_MIGRATION.sql\n';
            END IF;
        END LOOP;
    END;

    -- ========================================================================
    -- 6. CHECK TRIGGERS
    -- ========================================================================
    v_result := v_result || E'\n\n🔔 TRIGGERS\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    -- Check for updated_at triggers
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(DISTINCT tgname) INTO v_count
    FROM pg_trigger
    WHERE tgname LIKE '%updated_at%';
    
    IF v_count >= 5 THEN
        v_result := v_result || '✅ handle_updated_at triggers (found ' || v_count || E')\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || '❌ handle_updated_at triggers incomplete (found ' || v_count || E', need 5+)\n';
        v_missing := v_missing || E'\n-- Fix: handle_updated_at triggers missing. Run MASTER_MIGRATION.sql\n';
    END IF;

    -- Check for calculate_total_hours trigger
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count
    FROM pg_trigger
    WHERE tgname = 'calculate_total_hours_trigger';
    
    IF v_count > 0 THEN
        v_result := v_result || E'✅ calculate_total_hours trigger on time_entries\n';
        v_passed_checks := v_passed_checks + 1;
    ELSE
        v_result := v_result || E'❌ calculate_total_hours trigger is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: calculate_total_hours trigger missing. Run MASTER_MIGRATION.sql\n';
    END IF;

    -- ========================================================================
    -- 7. CHECK ROW LEVEL SECURITY (RLS)
    -- ========================================================================
    v_result := v_result || E'\n\n🔒 ROW LEVEL SECURITY (RLS)\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    DECLARE
        tables_needing_rls TEXT[] := ARRAY[
            'organizations', 'user_roles', 'super_admins', 'managers', 'workers',
            'jobs', 'job_assignments', 'time_entries', 'time_amendments',
            'expense_types', 'additional_costs', 'photos', 'subscription_usage',
            'notifications', 'notification_preferences', 'tutorial_completion'
        ];
        table_name TEXT;
        rls_enabled BOOLEAN;
    BEGIN
        FOREACH table_name IN ARRAY tables_needing_rls
        LOOP
            v_total_checks := v_total_checks + 1;
            SELECT relrowsecurity INTO rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = table_name;
            
            IF rls_enabled THEN
                v_result := v_result || '✅ RLS enabled on ' || table_name || E'\n';
                v_passed_checks := v_passed_checks + 1;
            ELSE
                v_result := v_result || '❌ RLS NOT enabled on ' || table_name || E'\n';
                v_missing := v_missing || E'\n-- Fix: Enable RLS on ' || table_name || E'\nALTER TABLE public.' || table_name || E' ENABLE ROW LEVEL SECURITY;\n';
            END IF;
        END LOOP;
    END;

    -- Check total RLS policies count
    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    v_result := v_result || E'\n📊 Total RLS Policies Found: ' || v_count || E' (should be 80+)\n';
    IF v_count < 80 THEN
        v_result := v_result || E'⚠️  Warning: Expected 80+ policies, found ' || v_count || E'. Run MASTER_MIGRATION.sql\n';
    END IF;

    -- ========================================================================
    -- 8. CHECK STORAGE BUCKET
    -- ========================================================================
    v_result := v_result || E'\n\n📁 STORAGE BUCKETS\n' || E'─────────────────────────────────────────────────────────────────────\n';
    
    v_total_checks := v_total_checks + 1;
    SELECT COUNT(*) INTO v_count
    FROM storage.buckets
    WHERE name = 'worker-photos';
    
    IF v_count > 0 THEN
        v_result := v_result || E'✅ worker-photos bucket exists\n';
        v_passed_checks := v_passed_checks + 1;
        
        -- Check storage policies
        SELECT COUNT(*) INTO v_count
        FROM storage.policies
        WHERE bucket_id = 'worker-photos';
        
        v_result := v_result || E'📊 Storage policies found: ' || v_count || E' (need 3)\n';
        IF v_count < 3 THEN
            v_result := v_result || E'⚠️  Warning: Expected 3 storage policies, found ' || v_count || E'\n';
        END IF;
    ELSE
        v_result := v_result || E'❌ worker-photos bucket is MISSING\n';
        v_missing := v_missing || E'\n-- Fix: Create worker-photos storage bucket in Supabase Dashboard\n-- Storage > Create Bucket > Name: worker-photos, Public: true\n';
    END IF;

    -- ========================================================================
    -- 9. SUMMARY REPORT
    -- ========================================================================
    v_result := v_result || E'\n\n';
    v_result := v_result || E'╔════════════════════════════════════════════════════════════════════╗\n';
    v_result := v_result || E'║                        SUMMARY REPORT                              ║\n';
    v_result := v_result || E'╠════════════════════════════════════════════════════════════════════╣\n';
    v_result := v_result || E'║  Total Checks:  ' || LPAD(v_total_checks::TEXT, 3) || '                                                 ║' || E'\n';
    v_result := v_result || E'║  Passed:        ' || LPAD(v_passed_checks::TEXT, 3) || '                                                 ║' || E'\n';
    v_result := v_result || E'║  Failed:        ' || LPAD((v_total_checks - v_passed_checks)::TEXT, 3) || '                                                 ║' || E'\n';
    v_result := v_result || E'║  Success Rate:  ' || LPAD(ROUND((v_passed_checks::NUMERIC / v_total_checks * 100), 1)::TEXT, 5) || '%                                          ║' || E'\n';
    v_result := v_result || E'╚════════════════════════════════════════════════════════════════════╝\n\n';

    IF v_total_checks = v_passed_checks THEN
        v_result := v_result || E'🎉 CONGRATULATIONS! All database objects are properly configured.\n\n';
        v_result := v_result || E'Next Steps:\n';
        v_result := v_result || E'1. Transfer secrets to Supabase Dashboard (Edge Functions > Manage Secrets)\n';
        v_result := v_result || E'   Required secrets:\n';
        v_result := v_result || E'   - GOOGLE_GEOCODING_API_KEY\n';
        v_result := v_result || E'   - RESEND_API_KEY\n';
        v_result := v_result || E'   - FROM_EMAIL\n';
        v_result := v_result || E'   - TO_EMAIL\n\n';
        v_result := v_result || E'2. Test authentication flow\n';
        v_result := v_result || E'3. Test edge functions\n';
        v_result := v_result || E'4. Verify application functionality\n';
    ELSE
        v_result := v_result || E'⚠️  ISSUES FOUND! Please review the missing objects below.\n\n';
        v_result := v_result || E'╔════════════════════════════════════════════════════════════════════╗\n';
        v_result := v_result || E'║                    REMEDIATION COMMANDS                            ║\n';
        v_result := v_result || E'╚════════════════════════════════════════════════════════════════════╝\n';
        v_result := v_result || v_missing;
        v_result := v_result || E'\n\n⚠️  RECOMMENDATION: Run the complete MASTER_MIGRATION.sql script\n';
        v_result := v_result || E'   to ensure all objects are properly created.\n';
    END IF;

    -- Output the result
    RAISE NOTICE '%', v_result;
END $$;
