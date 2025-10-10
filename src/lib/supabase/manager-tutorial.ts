/**
 * Manager Tutorial API
 * Manages tutorial status using managers.first_login_completed field
 * and localStorage for multi-page tutorial flows
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

/**
 * Check if specific page tutorial has been seen
 * @param page - The page identifier
 * @returns true if page tutorial has been completed
 */
export async function getPageTutorialStatus(page: 'dashboard' | 'workers' | 'amendments' | 'reports' | 'jobs'): Promise<boolean> {
  const key = `tutorial-${page}-completed`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark specific page tutorial as complete
 * @param page - The page identifier
 */
export async function markPageTutorialComplete(page: 'dashboard' | 'workers' | 'amendments' | 'reports' | 'jobs'): Promise<void> {
  const key = `tutorial-${page}-completed`;
  localStorage.setItem(key, 'true');
}

/**
 * Check if workers page tutorial should auto-continue
 * @returns true if should auto-run workers tutorial
 */
export async function shouldAutoContinueWorkersPage(): Promise<boolean> {
  const flag = localStorage.getItem('tutorial-auto-continue-workers');
  return flag === 'true';
}

/**
 * Set flag for workers page auto-continuation
 * @param value - Whether to auto-continue
 */
export async function setAutoContinueWorkersPage(value: boolean): Promise<void> {
  if (value) {
    localStorage.setItem('tutorial-auto-continue-workers', 'true');
  } else {
    localStorage.removeItem('tutorial-auto-continue-workers');
  }
}

/**
 * Check if jobs page tutorial should auto-continue
 * @returns true if should auto-run jobs tutorial
 */
export async function shouldAutoContinueJobsPage(): Promise<boolean> {
  const flag = localStorage.getItem('tutorial-auto-continue-jobs');
  return flag === 'true';
}

/**
 * Set flag for jobs page auto-continuation
 * @param value - Whether to auto-continue
 */
export async function setAutoContinueJobsPage(value: boolean): Promise<void> {
  if (value) {
    localStorage.setItem('tutorial-auto-continue-jobs', 'true');
  } else {
    localStorage.removeItem('tutorial-auto-continue-jobs');
  }
}
