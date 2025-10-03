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

      if (orgError) throw orgError;

      const limit = type === 'worker' ? org?.max_workers : org?.max_managers;

      // Count current active records with separate queries to avoid TypeScript issues
      let count: number | null = 0;
      
      if (type === 'worker') {
        const { count: workerCount, error: countError } = await supabase
          .from('workers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true);
        
        if (countError) throw countError;
        count = workerCount;
      } else {
        const { count: managerCount, error: countError } = await supabase
          .from('managers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        
        if (countError) throw countError;
        count = managerCount;
      }

      const current = count ?? 0;

      // NULL limit = unlimited
      if (limit === null || limit === undefined) {
        return { 
          canCreate: true, 
          current, 
          limit: null, 
          remaining: null 
        };
      }

      return {
        canCreate: current < limit,
        current,
        limit,
        remaining: Math.max(limit - current, 0)
      };
    } catch (error) {
      console.error('Error checking capacity:', error);
      // On error, allow creation but log the issue
      return {
        canCreate: true,
        current: 0,
        limit: null,
        remaining: null
      };
    }
  };

  return { checkCapacity };
}
