/**
 * Services Index
 * Central export point for all services
 * Following SOLID principles - Dependency Inversion
 */

// Types
export * from './types';

// Auth Service
export { AuthService, authService } from './auth/AuthService';
export type { SignInCredentials, SignUpInput, RoleAndOrg } from './auth/AuthService';

// Worker Service
export { WorkerService, workerService } from './workers/WorkerService';
export type {
  CreateWorkerInput,
  UpdateWorkerInput,
  WorkerCredentials,
  CreateWorkerResult,
} from './workers/WorkerService';

// Job Service
export { JobService, jobService } from './jobs/JobService';
export type {
  CreateJobInput,
  UpdateJobInput,
  GeocodeResult,
} from './jobs/JobService';

// Organization Service
export { OrganizationService, organizationService } from './organizations/OrganizationService';
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationWithManagers,
} from './organizations/OrganizationService';
