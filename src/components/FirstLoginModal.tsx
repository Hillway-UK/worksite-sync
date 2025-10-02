import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface FirstLoginModalProps {
  open: boolean;
  onDismiss: () => void;
}

export function FirstLoginModal({ open, onDismiss }: FirstLoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Friendly Reminder
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="space-y-3 pt-2">
          <p className="text-base text-foreground">
            You're currently using a temporary password.
          </p>
          <p className="text-base text-foreground">
            For your security, please update your password now. 
            Go to <span className="font-semibold">Profile → Change Password</span>.
          </p>
        </DialogDescription>
        <DialogFooter>
          <Button onClick={onDismiss} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
