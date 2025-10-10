import React, { useState, useEffect } from 'react';
import { OnboardingTour } from './OnboardingTour';
import { CompletionModal } from './CompletionModal';
import { Step } from 'react-joyride';
import {
  getManagerTutorialStatus,
  markManagerTutorialComplete,
  resetManagerTutorial,
} from '@/lib/supabase/manager-tutorial';
import { useToast } from '@/hooks/use-toast';

interface ManagerTourGateProps {
  steps: Step[];
  autoRun?: boolean; // Auto-run on first login
  forceRun?: boolean; // Manual replay
  onTourEnd?: () => void;
}

export const ManagerTourGate: React.FC<ManagerTourGateProps> = ({
  steps,
  autoRun = true,
  forceRun = false,
  onTourEnd,
}) => {
  const [runTour, setRunTour] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (forceRun) {
        await resetManagerTutorial();
        setRunTour(true);
        return;
      }

      if (autoRun) {
        const hasSeenTutorial = await getManagerTutorialStatus();
        if (!hasSeenTutorial) {
          // First time user - delay for page load
          setTimeout(() => setRunTour(true), 800);
        }
      }
    };

    checkTutorialStatus();
  }, [autoRun, forceRun]);

  const handleComplete = async () => {
    setRunTour(false);
    await markManagerTutorialComplete();
    setShowCompletionModal(true);
  };

  const handleSkip = async () => {
    setRunTour(false);
    await markManagerTutorialComplete();
    toast({
      title: 'Tutorial skipped',
      description: 'You can replay it anytime from the dashboard.',
    });
    onTourEnd?.();
  };

  const handleReplay = async () => {
    setShowCompletionModal(false);
    await resetManagerTutorial();
    setTimeout(() => setRunTour(true), 300);
  };

  const handleCloseModal = () => {
    setShowCompletionModal(false);
    onTourEnd?.();
  };

  return (
    <>
      <OnboardingTour
        steps={steps}
        run={runTour}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
      <CompletionModal
        open={showCompletionModal}
        onReplay={handleReplay}
        onClose={handleCloseModal}
      />
    </>
  );
};
