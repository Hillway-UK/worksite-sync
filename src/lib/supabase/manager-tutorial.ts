/**
 * Manager Tutorial API
 * Manages tutorial status using managers.first_login_completed field
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Check if manager has seen the tutorial
 * @returns true if tutorial has been completed, false otherwise
 */
export async function getManagerTutorialStatus(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return true; // Already seen (skip)

  const { data } = await supabase
    .from('managers')
    .select('first_login_completed')
    .eq('email', user.email)
    .single();

  return data?.first_login_completed ?? true;
}

/**
 * Mark tutorial as complete
 */
export async function markManagerTutorialComplete(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  await supabase
    .from('managers')
    .update({ first_login_completed: true })
    .eq('email', user.email);
}

/**
 * Reset tutorial (for replay)
 */
export async function resetManagerTutorial(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  await supabase
    .from('managers')
    .update({ first_login_completed: false })
    .eq('email', user.email);
}
