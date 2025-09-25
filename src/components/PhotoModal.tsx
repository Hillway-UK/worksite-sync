import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  workerName: string;
  timestamp: string;
  jobName?: string;
}

export function PhotoModal({ 
  isOpen, 
  onClose, 
  photoUrl, 
  workerName, 
  timestamp, 
  jobName 
}: PhotoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Clock Entry Photo</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <img 
              src={photoUrl} 
              alt="Clock entry photo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Worker:</span>
              <p className="font-medium">{workerName}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Date & Time:</span>
              <p className="font-medium">{timestamp}</p>
            </div>
            {jobName && (
              <div className="col-span-2">
                <span className="font-medium text-muted-foreground">Job Location:</span>
                <p className="font-medium">{jobName}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}