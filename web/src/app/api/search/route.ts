import { NextRequest } from 'next/server';
import { getAuthenticatedUser, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const EMPTY_SEARCH_RESULTS = { projects: [], companies: [], engagements: [] };
const SEARCH_LIMIT = 10;

/**
 * GET /api/search?q=term
 * Global search across projects, companies (partners), and engagements.
 * Returns grouped results by entity type.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return Response.json({ data: EMPTY_SEARCH_RESULTS });
    }

    const supabase = getSupabaseAdmin();
    const pattern = `%${q}%`;
    const companyId = user.company_id;

    // Search projects (live or user's own)
    let projectQuery = supabase
      .from('projects')
      .select('id, name, technology_type, location_country, location_region, project_size_mw, project_stage, status, developer:companies(id, name, logo_url)')
      .is('deleted_at', null)
      .or(`name.ilike.${pattern},location_country.ilike.${pattern},location_region.ilike.${pattern},technology_type.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT);

    if (!user.is_platform_admin) {
      if (user.role === 'DEVELOPER') {
        projectQuery = projectQuery.eq('developer_id', user.company_id);
      } else {
        projectQuery = projectQuery.eq('status', 'live').eq('is_visible_to_investors', true);
      }
    }

    // Search companies (partners)
    const companyQuery = supabase
      .from('companies')
      .select('id, name, type, country, logo_url, description')
      .is('deleted_at', null)
      .or(`name.ilike.${pattern},description.ilike.${pattern},country.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT);

    const engagementQuery = async () => {
      let query = supabase
        .from('engagements')
        .select('id, status, created_at, counterparty_type, project:projects!inner(id, name)')
        .order('created_at', { ascending: false })
        .limit(SEARCH_LIMIT);

      if (!user.is_platform_admin) {
        if (!companyId) return { data: [] };

        const [{ data: devProjects }, { data: capitalPartners }, { data: technicalPartners }] = await Promise.all([
          supabase.from('projects').select('id').eq('developer_id', companyId).is('deleted_at', null),
          supabase.from('capital_partners').select('id').eq('company_id', companyId),
          supabase.from('technical_partners').select('id').eq('company_id', companyId),
        ]);

        const projectIds = (devProjects ?? []).map((project) => project.id);
        const partnerIds = [
          ...(capitalPartners ?? []).map((partner) => partner.id),
          ...(technicalPartners ?? []).map((partner) => partner.id),
        ];

        if (projectIds.length === 0 && partnerIds.length === 0) return { data: [] };

        const accessFilters = [
          ...projectIds.map((id) => `project_id.eq.${id}`),
          ...partnerIds.map((id) => `counterparty_id.eq.${id}`),
        ];
        query = query.or(accessFilters.join(','));
      }

      return query.ilike('project.name', pattern);
    };

    const [projects, companies, engagements] = await Promise.all([
      projectQuery,
      companyQuery,
      engagementQuery(),
    ]);

    return Response.json({
      data: {
        projects: projects.data ?? [],
        companies: companies.data ?? [],
        engagements: engagements.data ?? [],
      },
    });
  } catch (e: unknown) {
    return handleRouteError(e);
  }
}
