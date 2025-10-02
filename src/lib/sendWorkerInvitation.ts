import { supabase } from '@/integrations/supabase/client';

export type SendWorkerInvitationParams = {
  email: string;
  fullName: string;
  orgName: string;
  tempPassword: string;
  issuedAt?: string;
  dryRun?: boolean;
};

export type SendWorkerInvitationResponse = {
  ok: true;
  id?: string;
  dryRun?: boolean;
  loginHref?: string;
} | {
  ok: false;
  error: string;
};

export async function sendWorkerInvitation({
  email,
  fullName,
  orgName,
  tempPassword,
  issuedAt = new Date().toISOString(),
  dryRun = false,
}: SendWorkerInvitationParams): Promise<SendWorkerInvitationResponse> {
  const { data, error } = await supabase.functions.invoke('send-worker-invitation', {
    body: {
      email,
      fullName,
      orgName,
      tempPassword,
      issuedAt,
      __dryRun: dryRun,
    },
  });

  if (error) {
    throw error;
  }

  return data as SendWorkerInvitationResponse;
}
