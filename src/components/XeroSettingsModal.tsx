import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface XeroSettings {
  prefix: string;
  startingNumber: number;
  accountCode: string;
  taxType: string;
  paymentTerms: number;
}

interface XeroSettingsModalProps {
  onSettingsChange: (settings: XeroSettings) => void;
}

export function XeroSettingsModal({ onSettingsChange }: XeroSettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<XeroSettings>({
    prefix: 'INV',
    startingNumber: 1001,
    accountCode: '5000',
    taxType: '20% VAT',
    paymentTerms: 30,
  });

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = {
      prefix: localStorage.getItem('xero_settings_prefix') || 'INV',
      startingNumber: parseInt(localStorage.getItem('xero_settings_starting_number') || '1001'),
      accountCode: localStorage.getItem('xero_settings_account_code') || '5000',
      taxType: localStorage.getItem('xero_settings_tax_type') || '20% VAT',
      paymentTerms: parseInt(localStorage.getItem('xero_settings_payment_terms') || '30'),
    };
    setSettings(savedSettings);
    onSettingsChange(savedSettings);
  }, [onSettingsChange]);

  const saveSettings = () => {
    // Save to localStorage
    localStorage.setItem('xero_settings_prefix', settings.prefix);
    localStorage.setItem('xero_settings_starting_number', settings.startingNumber.toString());
    localStorage.setItem('xero_settings_account_code', settings.accountCode);
    localStorage.setItem('xero_settings_tax_type', settings.taxType);
    localStorage.setItem('xero_settings_payment_terms', settings.paymentTerms.toString());

    onSettingsChange(settings);
    setIsOpen(false);
    
    toast({
      title: "Settings Saved",
      description: "Xero export settings have been saved successfully",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Xero Export Settings</DialogTitle>
            <p className="text-sm text-muted-foreground">
              These are supplier bills from contractors, not sales invoices
            </p>
          </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prefix" className="text-right">
              Invoice Prefix
            </Label>
            <Input
              id="prefix"
              value={settings.prefix}
              onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
              className="col-span-3"
              placeholder="INV"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startingNumber" className="text-right">
              Starting Number
            </Label>
            <Input
              id="startingNumber"
              type="number"
              value={settings.startingNumber}
              onChange={(e) => setSettings({ ...settings, startingNumber: parseInt(e.target.value) || 1001 })}
              className="col-span-3"
              placeholder="1001"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="accountCode" className="text-right">
              Account Code
            </Label>
            <Input
              id="accountCode"
              value={settings.accountCode}
              onChange={(e) => setSettings({ ...settings, accountCode: e.target.value })}
              className="col-span-3"
              placeholder="5000"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taxType" className="text-right">
              Tax Type
            </Label>
            <Select
              value={settings.taxType}
              onValueChange={(value) => setSettings({ ...settings, taxType: value })}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select tax type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20% VAT">20% VAT</SelectItem>
                <SelectItem value="0% VAT">0% VAT</SelectItem>
                <SelectItem value="No VAT">No VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="paymentTerms" className="text-right">
              Payment Terms (Days)
            </Label>
            <Input
              id="paymentTerms"
              type="number"
              value={settings.paymentTerms}
              onChange={(e) => setSettings({ ...settings, paymentTerms: parseInt(e.target.value) || 30 })}
              className="col-span-3"
              placeholder="30"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}