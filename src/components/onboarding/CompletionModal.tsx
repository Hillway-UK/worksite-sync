import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CompletionModalProps {
  open: boolean;
  onReplay: () => void;
  onClose: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  onReplay,
  onClose,
}) => {
  useEffect(() => {
    if (open) {
      // Confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        confetti({
          particleCount: 3,
          angle: randomInRange(55, 125),
          spread: randomInRange(50, 70),
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
          colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'],
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            🎉 You're all set!
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-4">
            You now know the essentials of your Manager Portal. If you want a refresher later,
            just click the "Run Tutorial" button on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center pt-4">
          <Button variant="outline" onClick={onReplay} className="w-full sm:w-auto">
            Replay Tutorial
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Explore Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
