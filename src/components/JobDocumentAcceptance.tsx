import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface JobDocumentAcceptanceProps {
  jobName: string;
  termsUrl?: string | null;
  waiverUrl?: string | null;
  showDocuments?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  open: boolean;
}

export function JobDocumentAcceptance({
  jobName,
  termsUrl,
  waiverUrl,
  showDocuments = true,
  onAccept,
  onDecline,
  open,
}: JobDocumentAcceptanceProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // If documents are disabled globally, auto-accept and don't show dialog
  React.useEffect(() => {
    if (!showDocuments && open) {
      onAccept();
    }
  }, [showDocuments, open, onAccept]);

  const hasDocuments = termsUrl || waiverUrl;
  const requiresBoth = termsUrl && waiverUrl;
  const canProceed = requiresBoth 
    ? (termsAccepted && waiverAccepted)
    : (termsAccepted || waiverAccepted);

  // If documents are disabled or no documents exist, return null
  if (!showDocuments || !hasDocuments) {
    return null;
  }

  const handleDownload = async (url: string, type: string) => {
    try {
      window.open(url, '_blank');
      toast.success(`${type} opened in new tab`);
    } catch (error) {
      toast.error(`Failed to open ${type}`);
    }
  };

  const handleAccept = () => {
    if (!canProceed) {
      toast.error('Please review and accept all required documents');
      return;
    }
    onAccept();
  };

  if (!hasDocuments) {
    // No documents to show, proceed directly
    onAccept();
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Review Job Documents - {jobName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please review and accept the following documents before clocking in to this job site.
            </AlertDescription>
          </Alert>

          {/* Terms and Conditions */}
          {termsUrl && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Terms and Conditions</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(termsUrl, 'Terms and Conditions')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  View Document
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="terms-checkbox" className="text-sm cursor-pointer">
                  I have read and accept the Terms and Conditions
                </label>
                {termsAccepted && (
                  <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
                )}
              </div>
            </div>
          )}

          {/* Waiver/Consent Form */}
          {waiverUrl && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Waiver/Consent Form</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(waiverUrl, 'Waiver Form')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  View Document
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="waiver-checkbox"
                  checked={waiverAccepted}
                  onChange={(e) => setWaiverAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="waiver-checkbox" className="text-sm cursor-pointer">
                  I have read and accept the Waiver/Consent Form
                </label>
                {waiverAccepted && (
                  <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
                )}
              </div>
            </div>
          )}

          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              By accepting these documents, you acknowledge that you have read, understood, and agree to abide by the terms outlined.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onDecline}
            className="flex-1"
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!canProceed}
            className="flex-1"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
