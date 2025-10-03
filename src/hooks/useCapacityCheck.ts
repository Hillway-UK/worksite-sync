import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CapacityType = 'manager' | 'worker';

interface CapacityData {
  planned: number;
  active: number;
  available: number;
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
        .rpc('get_subscription_capacity', { org_id: organizationId });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return { 
          allowed: false, 
          error: 'No subscription plan found for this organization' 
        };
      }

      const capacity = data[0];
      
      if (type === 'manager') {
        const available = capacity.managers_available || 0;
        return {
          allowed: available > 0,
          capacity: {
            planned: capacity.planned_managers,
            active: capacity.active_managers,
            available
          }
        };
      } else {
        const available = capacity.workers_available || 0;
        return {
          allowed: available > 0,
          capacity: {
            planned: capacity.planned_workers,
            active: capacity.active_workers,
            available
          }
        };
      }
    } catch (error: any) {
      console.error('Capacity check error:', error);
      return { allowed: false, error: error.message };
    } finally {
      setChecking(false);
    }
  };

  return { checkCapacity, checking };
};
