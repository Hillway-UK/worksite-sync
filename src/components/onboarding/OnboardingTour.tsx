import React from 'react';
import Joyride, { Step, CallBackProps, STATUS, ACTIONS } from 'react-joyride';

interface OnboardingTourProps {
  steps: Step[];
  run: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  run,
  onComplete,
  onSkip,
  onStepChange,
}) => {
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // Track step changes
    if ((action === ACTIONS.NEXT || action === ACTIONS.PREV) && onStepChange) {
      onStepChange(index);
    }

    if (finishedStatuses.includes(status)) {
      if (action === 'skip' || status === STATUS.SKIPPED) {
        onSkip();
      } else {
        onComplete();
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableCloseOnEsc={false}
      scrollToFirstStep
      scrollOffset={100}
      spotlightPadding={8}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          fontSize: 15,
          zIndex: 10001,
        },
        overlay: {
          zIndex: 9999,
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: 6,
          padding: '8px 16px',
          cursor: 'pointer',
          pointerEvents: 'auto',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          cursor: 'pointer',
          pointerEvents: 'auto',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
          cursor: 'pointer',
          pointerEvents: 'auto',
        },
        spotlight: {
          zIndex: 9998,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      callback={handleJoyrideCallback}
    />
  );
};
