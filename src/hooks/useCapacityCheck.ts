import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CapacityType = 'manager' | 'worker';

interface CapacityData {
  canAddManager: boolean;
  canAddWorker: boolean;
  currentManagerCount: number;
  currentWorkerCount: number;
  maxManagers: number | null;
  maxWorkers: number | null;
  plannedManagers: number;
  plannedWorkers: number;
  planName: string;
}

export const useCapacityCheck = () => {
  const [checking, setChecking] = useState(false);

  const checkCapacity = async (
    organizationId: string,
    type: CapacityType
  ): Promise<{ allowed: boolean; capacity?: CapacityData; error?: string }> => {
    setChecking(true);
    
    try {
      const { data, error } = await supabase
        .rpc('check_capacity_with_plan', { org_id: organizationId });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return { 
          allowed: false, 
          error: 'No subscription plan found for this organization' 
        };
      }

      const capacityInfo = data[0];
      
      const allowed = type === 'manager' 
        ? capacityInfo.can_add_manager 
        : capacityInfo.can_add_worker;
      
      return {
        allowed,
        capacity: {
          canAddManager: capacityInfo.can_add_manager,
          canAddWorker: capacityInfo.can_add_worker,
          currentManagerCount: capacityInfo.current_manager_count,
          currentWorkerCount: capacityInfo.current_worker_count,
          maxManagers: capacityInfo.max_managers === 999999 ? null : capacityInfo.max_managers,
          maxWorkers: capacityInfo.max_workers === 999999 ? null : capacityInfo.max_workers,
          plannedManagers: capacityInfo.planned_managers,
          plannedWorkers: capacityInfo.planned_workers,
          planName: capacityInfo.plan_name
        }
      };
    } catch (error: any) {
      console.error('Capacity check error:', error);
      return { allowed: false, error: error.message };
    } finally {
      setChecking(false);
    }
  };

  return { checkCapacity, checking };
};
