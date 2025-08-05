import React from 'react';
import { Layout } from '@/components/Layout';
import { Clock as ClockIcon } from 'lucide-react';

export default function Clock() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <ClockIcon className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Clock In/Out Page
          </h1>
          <p className="text-muted-foreground">
            Worker dashboard for time tracking
          </p>
        </div>
      </div>
    </Layout>
  );
}