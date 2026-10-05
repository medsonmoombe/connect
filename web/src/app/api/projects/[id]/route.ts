import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorized, serverError, forbidden, writeAuditLog, handleRouteError, pickFields, verifyProjectOwnership, verifyEngagementAccess } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { activateAndNotify } from '@/lib/activation-notify';
import {
  partitionEditablePayload,
  partitionTechPayload,
  isFieldLockedWhileLive,
  MATERIAL_FIELDS_LOCKED_MESSAGE,
  SYSTEM_FIELDS,
} from '@/lib/project-edit-policy';
import { normalizeBreakdown, dimensionMaximaFromBreakdown } from '@/lib/scoring/engine';
import { isScoreHiddenForDeveloper, type ProjectStatus } from '@/lib/project-state-machine';
import { isReviewerUser } from '@/lib/admin-access';

type Params = { params: Promise<{ id: string }> };

/** Raised when a manual score override would store an inconsistent score. */
class ScoreValidationError extends Error {}

/** Pass a supplied total through as a number, or undefined when absent. */
function suppliedTotalOrCheck(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

const PROJECT_UPDATE_FIELDS = [
  'name', 'technology_type', 'location_country', 'location_region',
  'project_size_mw', 'capital_required', 'capital_structure_type',
  'capex', 'opex', 'funding_required', 'description',
  'governance_terms', 'exit_terms', 'risk_disclosures',
  'target_financial_close_date', 'target_cod',
  'has_secured_land', 'land_title_status',
  'has_reached_financial_close', 'regulatory_approvals',
  // Wizard UI state — where the developer left off in the submission form, so a
  // draft reopens at the same step. Not a project fact; never shown to reviewers.
  'draft_step',
  // Tier-C system fields (project_stage, rejection_reason) are intentionally
  // excluded for developers — they are AI/reviewer-owned (project-edit-policy.ts).
];

/** Field whitelist for platform admins — includes Tier-C system fields. */
const ADMIN_PROJECT_UPDATE_FIELDS = [...PROJECT_UPDATE_FIELDS, ...SYSTEM_FIELDS];

// Statuses in which a developer may PATCH the project at all.
// (paused/archived/deactivated are not editable — resume/reactivate first.)
const EDITABLE_STATUSES = ['draft', 'scoring', 'scoring_retry', 'pending_live', 'under_review', 'live'];

// GET /api/projects/[id]
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    // ID logged for debugging — remove in production

    // Sub-resource routing
    const resource = searchParams.get('resource');

    if (resource === 'matches') {
      const { data: projectAccess, error: projectAccessError } = await supabase
        .from('projects')
        .select('developer_id')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (projectAccessError || !projectAccess) {
        console.error('[Projects] Match access query error:', projectAccessError?.message);
        return serverError();
      }

      const canViewProjectMatches = user.is_platform_admin || projectAccess.developer_id === user.company_id;
      if (!canViewProjectMatches) {
        const engagementId = searchParams.get('engagement_id');
        let accessViaEngagement = false;

        if (engagementId && await verifyEngagementAccess(engagementId, user.company_id, user.is_platform_admin)) {
          // Partner/developer opening the page from an engagement link.
          accessViaEngagement = true;
        } else {
          // Fallback: engaged partners reach this page from marketplace cards
          // WITHOUT an engagement_id in the URL. Resolve any active engagement
          // between their org and this project and grant access if one exists.
          // Collect this org's partner-profile ids across all partner tables
          const [cap, tech, cons, grant, trader] = await Promise.all([
            supabase.from('capital_partners').select('id').eq('company_id', user.company_id ?? '').maybeSingle(),
            supabase.from('technical_partners').select('id').eq('company_id', user.company_id ?? '').maybeSingle(),
            supabase.from('consultants').select('id').eq('company_id', user.company_id ?? '').maybeSingle(),
            supabase.from('grant_providers').select('id').eq('company_id', user.company_id ?? '').maybeSingle(),
            supabase.from('power_traders').select('id').eq('company_id', user.company_id ?? '').maybeSingle(),
          ]);

          const partnerIds = [cap.data?.id, tech.data?.id, cons.data?.id, grant.data?.id, trader.data?.id]
            .filter((v): v is string => typeof v === 'string');

          if (partnerIds.length > 0) {
            const { data: activeEng } = await supabase
              .from('engagements')
              .select('id')
              .eq('project_id', id)
              .in('counterparty_id', partnerIds)
              .neq('status', 'DROPPED')
              .limit(1)
              .maybeSingle();
            accessViaEngagement = !!activeEng;
          }
        }

        if (!accessViaEngagement) {
          return forbidden();
        }
      }

      // PRD §4.A/H: each party sees their ranked TOP-5 matches. We cap by default
      // but allow an explicit limit for the admin's full view. Only `active`
      // matches are returned (PRD §5.2 — stale matches are marked inactive, not
      // deleted).
      const TOP_N = 5;
      const requestedLimit = Number(searchParams.get('limit')) || TOP_N;
      const matchLimit = user.is_platform_admin
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : Math.min(Math.max(requestedLimit, 1), TOP_N);

      const [capital, technical, consultant, grantMatches, traderMatches] = await Promise.all([
        supabase.from('capital_match_results')
          .select('*, capital_partner:capital_partners(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
        supabase.from('technical_match_results')
          .select('*, technical_partner:technical_partners(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
        supabase.from('consultant_match_results')
          .select('*, consultant:consultants(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
        supabase.from('grant_match_results')
          .select('*, grant_provider:grant_providers(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
        supabase.from('power_trader_match_results')
          .select('*, power_trader:power_traders(*, company:companies(*))')
          .eq('project_id', id)
          .eq('status', 'active')
          .order('compatibility_score', { ascending: false })
          .limit(matchLimit),
      ]);

      // Merge grant matches into capital array as synthetic capital-partner-shaped rows
      // so the existing FindPartnersEngine pipeline handles them without changes.
      const grantAsCapital = (grantMatches.data ?? []).map((m: any) => ({
        ...m,
        capital_partner_id: m.grant_provider_id,
        capital_partner: {
          ...m.grant_provider,
          preferred_capital_structure: ['GRANT'],
          sector_focus: m.grant_provider?.focus_sectors ?? [],
          geographic_focus: m.grant_provider?.geographic_focus ?? [],
          min_ticket_size: m.grant_provider?.min_grant_size ?? 0,
          max_ticket_size: m.grant_provider?.max_grant_size ?? 0,
          risk_tolerance: 'HIGH',
          governance_preference: 'PASSIVE',
          company: m.grant_provider?.company,
        },
        _is_grant: true,
      }));

      const mergedCapital = [...(capital.data ?? []), ...grantAsCapital]
        .sort((a: any, b: any) => b.compatibility_score - a.compatibility_score)
        .slice(0, matchLimit);
      return Response.json({ capital: mergedCapital, technical: technical.data, consultant: consultant.data, trader: traderMatches.data });
    }

    if (resource === 'scores') {
      // This sub-resource bypassed both the ownership check and the score
      // visibility gate: it sat above them, so any authenticated user could
      // read raw `project_scores` for ANY project id — directly contradicting
      // the rule that a developer must not see the score before review.
      const { data: scoreProject, error: scoreProjectError } = await supabase
        .from('projects')
        .select('id, developer_id, status, rejection_reason')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (scoreProjectError || !scoreProject) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }

      const canReadScores = isReviewerUser(user) || scoreProject.developer_id === user.company_id;
      if (!canReadScores) return forbidden();

      if (isScoreHiddenForDeveloper(scoreProject.status as ProjectStatus, !!scoreProject.rejection_reason)) {
        // Same contract as the main endpoint: hidden means null, not 403, so a
        // client reading `scores` sees "not available yet" rather than an error
        // it might surface as a failure.
        return Response.json({ data: null, hidden: true });
      }

      const { data, error } = await supabase
        .from('project_scores').select('*').eq('project_id', id).single();
      if (error && error.code !== 'PGRST116') {
        console.error('[Projects] Scores query error:', error.message);
        return serverError();
      }
      return Response.json({ data });
    }

    if (resource === 'analytics') {
      const [views, engagements] = await Promise.all([
        supabase.from('audit_logs').select('action_type, created_at').eq('entity_id', id).in('action_type', ['PROJECT_VIEW', 'DATAROOM_ACCESS']).order('created_at', { ascending: false }).limit(500),
        supabase.from('engagements').select('status, created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(200),
      ]);
      const v = views.data || [];
      const e = engagements.data || [];
      return Response.json({
        data: {
          totalViews: v.filter(x => x.action_type === 'PROJECT_VIEW').length,
          dataroomAccess: v.filter(x => x.action_type === 'DATAROOM_ACCESS').length,
          funnel: {
            intro: e.length,
            nda: e.filter(x => ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            dueDiligence: e.filter(x => ['DUE_DILIGENCE', 'TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            termSheet: e.filter(x => ['TERM_SHEET', 'CLOSED'].includes(x.status)).length,
            closed: e.filter(x => x.status === 'CLOSED').length,
          },
        },
      });
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, tech_requirements:project_tech_requirements(*), documents:project_documents(*), scores:project_scores(*), developer:companies(*)')
      .is('deleted_at', null)
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Projects] Query error:', error.message);
      return serverError();
    }

    // Lazy activation: if a legacy project is still in `pending_live` and the
    // 24h timer has elapsed, activate it now. The new flow lands projects
    // directly in `under_review` (not `pending_live`) so this is a back-compat
    // path only.
    if (data?.status === 'pending_live' && data?.scores_visible_at) {
      const visibleAt = new Date(data.scores_visible_at);
      if (visibleAt <= new Date()) {
        const { activated } = await activateAndNotify(id);
        if (activated) {
          data.status = 'live';
          data.is_visible_to_investors = true;
        }
      }
    }

    // Non-owners can only see live visible projects
    const isOwner = user.is_platform_admin || data?.developer_id === user.company_id;
    if (!isOwner) {
      if (data?.status !== 'live' || !data?.is_visible_to_investors) {
        return forbidden();
      }
    }

    // ── Score visibility gate ──────────────────────────────────────────
    // The developer's AI score is hidden until either:
    //   (a) the project reaches `live` (authority/admin approved), or
    //   (b) the project is returned to `draft` with a reviewer comment, or
    //   (c) the project is in a terminal post-live state (deactivated, archived).
    // Reviewers (platform admin / authority) always see it — they need the score
    // to make their decision.
    //
    // Delegates to the shared predicate so this endpoint and /api/projects can
    // never drift apart. `paused` is included here deliberately: a project the
    // developer paused mid-review still hides its score.
    if (
      !isReviewerUser(user)
      && isScoreHiddenForDeveloper(data?.status as ProjectStatus, !!data?.rejection_reason)
    ) {
      data.scores = null;
    }

    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// PATCH /api/projects/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const allowedFields = user.is_platform_admin
      ? [...ADMIN_PROJECT_UPDATE_FIELDS, 'status']
      : PROJECT_UPDATE_FIELDS;

    // sub-resource: tech requirements
    if (body._resource === 'tech_requirements') {
      const { _resource, ...rest } = body;
      if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) {
        return forbidden('Only the project owner can manage documents for this project.');
      }

      // Material tech fields are locked while live/under_review — same rule as
      // the main project fields. Unchanged values are dropped (no-op writes).
      if (!user.is_platform_admin) {
        const { data: projStatusRow } = await supabase
          .from('projects')
          .select('status')
          .eq('id', id)
          .single();
        if (isFieldLockedWhileLive(projStatusRow?.status)) {
          const { data: currentTech } = await supabase
            .from('project_tech_requirements')
            .select('*')
            .eq('project_id', id)
            .maybeSingle();
          const { blockedFields } = partitionTechPayload(rest, currentTech, user.is_platform_admin);
          if (blockedFields.length > 0) {
            return Response.json(
              {
                success: false,
                code: 'MATERIAL_FIELDS_LOCKED',
                error: MATERIAL_FIELDS_LOCKED_MESSAGE.replace('{fields}', blockedFields.join(', ')),
                locked_fields: blockedFields,
              },
              { status: 403 }
            );
          }
          // Nothing material changed — skip the upsert entirely.
          return Response.json({ data: currentTech });
        }
      }

      const { data, error } = await supabase
        .from('project_tech_requirements')
        .upsert({ ...rest, project_id: id })
        .select().single();
      if (error) {
        console.error('[Projects] Tech requirements error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'PROJECT_TECH_UPDATED', entityType: 'project_tech_requirements', entityId: id, after: rest, req });
      return Response.json({ data });
    }

    // sub-resource: scores
    if (body._resource === 'scores') {
      const { _resource, ...rest } = body;

      // ── Validate before writing ─────────────────────────────────────────
      // A readiness score has to stay internally consistent: each dimension
      // within its documented maximum, and — when a caller supplies dimensions —
      // the headline score derived from them rather than asserted alongside
      // them. This is the guard against a stored total that contradicts the
      // breakdown rendered directly beneath it.
      const bounded = (value: unknown, max: number, field: string) => {
        const n = typeof value === 'string' ? Number(value) : (value as number);
        if (value === undefined || value === null || value === '') return 0;
        if (typeof n !== 'number' || !Number.isFinite(n)) {
          throw new ScoreValidationError(`${field} must be a number between 0 and ${max}.`);
        }
        const rounded = Math.round(n);
        if (rounded < 0 || rounded > max) {
          throw new ScoreValidationError(`${field} must be between 0 and ${max} (received ${rounded}).`);
        }
        return rounded;
      };

      let sanitized: Record<string, unknown>;
      try {
        // Validate against the maxima the stored score was measured with, not a
        // fixed table: an evidence-scored row measures regulatory out of 20, a
        // legacy row out of 40 — writing across the two produces impossible
        // values that look authoritative on screen.
        const { data: existingRow } = await supabase
          .from('project_scores')
          .select('breakdown')
          .eq('project_id', id)
          .maybeSingle();
        const maxima = dimensionMaximaFromBreakdown(existingRow?.breakdown);

        const dimensionInputs = {
          regulatory: bounded(rest.regulatory_score, maxima.regulatory, 'regulatory_score'),
          financial: bounded(rest.financial_score, maxima.financial, 'financial_score'),
          developer: bounded(rest.developer_score, maxima.developer, 'developer_score'),
        };
        const hasDimensions = ('regulatory_score' in rest) || ('financial_score' in rest) || ('developer_score' in rest);
        const normalized = normalizeBreakdown({
          regulatory: { score: dimensionInputs.regulatory },
          financial: { score: dimensionInputs.financial },
          developer: { score: dimensionInputs.developer },
          // An asserted headline total is never persisted over the derived one.
          total_score: hasDimensions ? suppliedTotalOrCheck(rest.capital_readiness_score) : undefined,
        }, maxima);
        if (normalized.reconciled) {
          console.warn('[Projects] Score override total replaced by derived total:', normalized.notes.join(' '), { projectId: id });
        }
        sanitized = {
          ...rest,
          project_id: id,
          regulatory_score: dimensionInputs.regulatory,
          financial_score: dimensionInputs.financial,
          developer_score: dimensionInputs.developer,
          capital_readiness_score: hasDimensions
            ? normalized.total
            : bounded(rest.capital_readiness_score, 100, 'capital_readiness_score'),
          technical_readiness_score: bounded(rest.technical_readiness_score, 100, 'technical_readiness_score'),
          documentation_score: bounded(rest.documentation_score, 100, 'documentation_score'),
          governance_score: bounded(rest.governance_score, 100, 'governance_score'),
          financial_transparency_score: bounded(rest.financial_transparency_score, 100, 'financial_transparency_score'),
        };
      } catch (e) {
        if (e instanceof ScoreValidationError) {
          return Response.json({ success: false, error: e.message }, { status: 422 });
        }
        throw e;
      }
      // Preserve documents_hash if not explicitly provided (e.g. manual overrides)
      if (!sanitized.documents_hash) delete sanitized.documents_hash;
      const { data, error } = await supabase
        .from('project_scores')
        .upsert(sanitized, { onConflict: 'project_id' })
        .select().single();
      if (error) {
        console.error('[Projects] Scores error:', error.message);
        return serverError();
      }
      await writeAuditLog({ userId: user.id, action: 'PROJECT_SCORES_UPDATED', entityType: 'project_scores', entityId: id, after: sanitized, req });
      return Response.json({ data });
    }

    // Ownership check for direct project updates
    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();

    // Status-gated edits: only draft/scoring/live/deactivated can be edited
    const { data: projStatus } = await supabase
      .from('projects')
      .select('status, developer_id')
      .eq('id', id)
      .single();

    if (projStatus && !EDITABLE_STATUSES.includes(projStatus.status) && !user.is_platform_admin) {
      return Response.json(
        { error: `Cannot edit project in '${projStatus.status}' status.` },
        { status: 403 }
      );
    }

    // ── Status-aware field lock (project-edit-policy.ts) ─────────────────
    // While the project is live / under_review, only "safe" narrative fields
    // may change. Material fields (capacity, capital, technology, location,
    // checklist claims) are rejected with a structured 403; unchanged values
    // round-tripped by the edit wizard are tolerated. Replaces the old
    // silent auto-drop-to-draft + score deletion.
    const isLockStatus = isFieldLockedWhileLive(projStatus?.status);
    let safeFields: Record<string, unknown>;
    if (isLockStatus && !user.is_platform_admin) {
      // Current row for change detection (material fields equal to the stored
      // value are treated as no-ops, not violations).
      const { data: currentRow } = await supabase
        .from('projects')
        .select('name, technology_type, location_country, location_region, project_size_mw, capital_required, capital_structure_type, capex, opex, funding_required, has_secured_land, land_title_status, has_reached_financial_close, regulatory_approvals')
        .eq('id', id)
        .single();

      const partitioned = partitionEditablePayload(
        pickFields(body, allowedFields),
        currentRow as Record<string, unknown> | null,
        user.is_platform_admin,
      );
      if (partitioned.blockedFields.length > 0) {
        await writeAuditLog({
          userId: user.id,
          action: 'PROJECT_UPDATE_BLOCKED',
          entityType: 'projects',
          entityId: id,
          after: { locked_fields: partitioned.blockedFields },
          req,
        });
        return Response.json(
          {
            success: false,
            code: 'MATERIAL_FIELDS_LOCKED',
            error: MATERIAL_FIELDS_LOCKED_MESSAGE.replace('{fields}', partitioned.blockedFields.join(', ')),
            locked_fields: partitioned.blockedFields,
          },
          { status: 403 }
        );
      }
      safeFields = partitioned.accepted;
    } else {
      safeFields = pickFields(body, allowedFields);
    }

    // Engagement lock: block edits if active investor discussions are ongoing
    if (!user.is_platform_admin) {
      const { count: activeEngagements } = await supabase
        .from('engagements')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .in('status', ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET']);

      if (activeEngagements && activeEngagements > 0) {
        return Response.json(
          { error: 'This project has active investor discussions. Edits are locked until discussions conclude.' },
          { status: 403 }
        );
      }
    }

    // Convert empty strings to null for date columns (mirrors POST /api/projects).
    // Empty string is not valid DATE syntax in Postgres.
    if (safeFields.target_financial_close_date === '') safeFields.target_financial_close_date = null;
    if (safeFields.target_cod === '') safeFields.target_cod = null;

    const { data, error } = await supabase
      .from('projects').update(safeFields).eq('id', id).select().single();
    if (error) {
      console.error('[Projects] Update error:', error.message);
      return serverError();
    }
    await writeAuditLog({ userId: user.id, action: 'PROJECT_UPDATED', entityType: 'projects', entityId: id, after: safeFields, req });
    return Response.json({ data });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    if (!await verifyProjectOwnership(id, user.company_id, user.is_platform_admin)) return forbidden();

    // Engagement lock: block deletion if active investor discussions are ongoing
    if (!user.is_platform_admin) {
      const { count: activeEngagements } = await supabase
        .from('engagements')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .in('status', ['NDA_SIGNED', 'DUE_DILIGENCE', 'TERM_SHEET']);

      if (activeEngagements && activeEngagements > 0) {
        return Response.json(
          { error: 'This project has active investor discussions and cannot be deleted.' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      console.error('[Projects] Delete error:', error.message);
      return serverError();
    }
    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}



