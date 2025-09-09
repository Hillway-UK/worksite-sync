import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  number: number;
  label: string;
  active: boolean;
  complete: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  number,
  label,
  active,
  complete
}) => {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
          complete
            ? 'bg-black text-white'
            : active
            ? 'bg-black text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {complete ? <Check className="w-5 h-5" /> : number}
      </div>
      <span className={`mt-2 text-sm ${active || complete ? 'text-black font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
};