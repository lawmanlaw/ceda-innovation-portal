export type Role = 'submitter' | 'evaluator' | 'adjudicator' | 'admin' | 'agent' | 'observer';
export type Stage = 'draft' | 'submitted' | 'in_review' | 'feedback' | 'approved' | 'awarded' | 'rejected' | 'withdrawn';

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In review' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'approved', label: 'Approved' },
  { key: 'awarded', label: 'Awarded' },
];

export const STAGE_LABEL: Record<Stage, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In review',
  feedback: 'Needs changes',
  approved: 'Approved',
  awarded: 'Awarded',
  rejected: 'Not taken forward',
  withdrawn: 'Withdrawn',
};

export const ROLE_LABEL: Record<Role, string> = {
  submitter: 'Innovator',
  evaluator: 'Evaluator',
  adjudicator: 'Adjudicator',
  admin: 'Administrator',
  agent: 'Service consultant',
  observer: 'Committee observer',
};

export type FormField = {
  id: string;
  key: string;
  label: string;
  help: string | null;
  kind: 'text' | 'textarea' | 'select' | 'number' | 'url';
  options: string[] | null;
  required: boolean;
  max_length: number;
  sort: number;
  active: boolean;
};

export type Idea = {
  id: string;
  lat: number | null;
  lng: number | null;
  connect_ok: boolean;
  ref: string;
  owner_id: string;
  title: string;
  summary: string;
  category_id: number | null;
  district: string;
  answers: Record<string, string>;
  stage: Stage;
  version: number;
  submitted_at: string;
  stage_changed_at: string;
  updated_at: string;
};
