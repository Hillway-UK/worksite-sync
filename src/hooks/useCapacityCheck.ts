import { supabase } from '@/integrations/supabase/client';

export interface CapacityInfo {
  canCreate: boolean;
  current: number;
  limit: number | null;
  remaining: number | null;
}

export function useCapacityCheck() {
  const checkCapacity = async (
    type: 'manager' | 'worker',
    organizationId: string
  ): Promise<CapacityInfo> => {
    try {
      // Fetch organization limits
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('max_workers, max_managers')
        .eq('id', organizationId)
        .single();

      if (orgError) {
        console.error('Failed to fetch organization limits:', orgError);
        return { canCreate: true, current: 0, limit: null, remaining: null };
      }

      const limit = type === 'worker' ? org?.max_workers : org?.max_managers;

      // Count current active records
      let count: number | null = null;
      let countError: any = null;

      if (type === 'worker') {
        const result = await supabase
          .from('workers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true);
        count = result.count;
        countError = result.error;
      } else {
        const result = await supabase
          .from('managers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        count = result.count;
        countError = result.error;
      }

      if (countError) {
        console.error('Failed to count records:', countError);
        // On error, allow creation (fail open)
        return { canCreate: true, current: 0, limit, remaining: null };
      }

      // NULL limit = unlimited
      if (limit === null || limit === undefined) {
        return {
          canCreate: true,
          current: count ?? 0,
          limit: null,
          remaining: null,
        };
      }

      const currentCount = count ?? 0;
      const remaining = Math.max(limit - currentCount, 0);

      return {
        canCreate: currentCount < limit,
        current: currentCount,
        limit,
        remaining,
      };
    } catch (error) {
      console.error('Capacity check error:', error);
      // On error, allow creation (fail open)
      return { canCreate: true, current: 0, limit: null, remaining: null };
    }
  };

  return { checkCapacity };
}
