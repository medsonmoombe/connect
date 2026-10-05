import { redirect } from 'next/navigation';

// Gap analysis is now accessed per-project from the project's page
// (e.g. /projects/[id]/gaps). Send anyone landing here back to the
// developer project list so they can pick a project first.
export default function DeveloperGapsRedirect() {
  redirect('/developer/projects');
}