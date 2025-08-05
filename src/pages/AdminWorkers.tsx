import React from 'react';
import { Layout } from '@/components/Layout';
import { Users } from 'lucide-react';

export default function AdminWorkers() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <Users className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Workers Management
          </h1>
          <p className="text-muted-foreground">
            Manage your workforce and worker profiles
          </p>
        </div>
      </div>
    </Layout>
  );
}