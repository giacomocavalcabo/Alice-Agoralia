/**
 * App Database Connection (Read-Only)
 * 
 * Connects to the Agoralia App PostgreSQL database on Railway
 * for monitoring purposes (calls, users, revenue, etc.)
 * 
 * This is READ-ONLY access - Alice should never write to App DB.
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

// Connection pool (lazy initialized)
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.APP_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('APP_DATABASE_URL not configured');
    }

    pool = new Pool({
      connectionString,
      max: 5, // Small pool for monitoring queries
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false, // Required for Railway self-signed certs
      },
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

/**
 * Execute a read-only query
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await getPool().connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Monitoring Queries
// ============================================

export interface ActiveCall {
  id: number;
  call_id: string;
  tenant_id: number;
  workspace_name: string;
  started_at: string;
  duration_seconds: number;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  agent_name: string;
}

/**
 * Get active calls (calls that are currently in progress)
 */
export async function getActiveCalls(): Promise<ActiveCall[]> {
  try {
    const result = await query<ActiveCall>(`
      SELECT 
        cr.id,
        cr.call_id,
        cr.tenant_id,
        t.name as workspace_name,
        cr.call_started_at as started_at,
        EXTRACT(EPOCH FROM (NOW() - cr.call_started_at))::int as duration_seconds,
        cr.direction,
        cr.call_status as status,
        cr.from_number,
        cr.to_number,
        a.name as agent_name
      FROM call_records cr
      LEFT JOIN tenants t ON cr.tenant_id = t.id
      LEFT JOIN agents a ON cr.agent_id = a.retell_agent_id
      WHERE cr.call_status IN ('in-progress', 'ringing', 'initiated')
        AND cr.call_started_at > NOW() - INTERVAL '1 hour'
      ORDER BY cr.call_started_at DESC
      LIMIT 100
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching active calls:', error);
    return [];
  }
}

export interface CallStats {
  total_calls_today: number;
  total_calls_week: number;
  total_calls_month: number;
  total_duration_minutes_today: number;
  total_duration_minutes_month: number;
  avg_duration_seconds: number;
}

/**
 * Get call statistics
 */
export async function getCallStats(): Promise<CallStats> {
  try {
    const result = await query<CallStats>(`
      SELECT 
        COUNT(*) FILTER (WHERE call_started_at >= CURRENT_DATE) as total_calls_today,
        COUNT(*) FILTER (WHERE call_started_at >= CURRENT_DATE - INTERVAL '7 days') as total_calls_week,
        COUNT(*) FILTER (WHERE call_started_at >= CURRENT_DATE - INTERVAL '30 days') as total_calls_month,
        COALESCE(SUM(duration_seconds) FILTER (WHERE call_started_at >= CURRENT_DATE) / 60, 0)::int as total_duration_minutes_today,
        COALESCE(SUM(duration_seconds) FILTER (WHERE call_started_at >= CURRENT_DATE - INTERVAL '30 days') / 60, 0)::int as total_duration_minutes_month,
        COALESCE(AVG(duration_seconds), 0)::int as avg_duration_seconds
      FROM call_records
      WHERE call_started_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    return result.rows[0] || {
      total_calls_today: 0,
      total_calls_week: 0,
      total_calls_month: 0,
      total_duration_minutes_today: 0,
      total_duration_minutes_month: 0,
      avg_duration_seconds: 0,
    };
  } catch (error) {
    console.error('Error fetching call stats:', error);
    return {
      total_calls_today: 0,
      total_calls_week: 0,
      total_calls_month: 0,
      total_duration_minutes_today: 0,
      total_duration_minutes_month: 0,
      avg_duration_seconds: 0,
    };
  }
}

export interface RevenueStats {
  total_revenue_cents_month: number;
  total_cost_cents_month: number;
  active_subscriptions: number;
  total_users: number;
  total_workspaces: number;
}

/**
 * Get revenue and user statistics
 */
export async function getRevenueStats(): Promise<RevenueStats> {
  try {
    const result = await query<RevenueStats>(`
      SELECT
        COALESCE((SELECT SUM(amount_cents) FROM billing_transactions WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed'), 0)::int as total_revenue_cents_month,
        COALESCE((SELECT SUM(cost_cents) FROM cost_events WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)::int as total_cost_cents_month,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')::int as active_subscriptions,
        (SELECT COUNT(*) FROM users)::int as total_users,
        (SELECT COUNT(*) FROM tenants)::int as total_workspaces
    `);
    return result.rows[0] || {
      total_revenue_cents_month: 0,
      total_cost_cents_month: 0,
      active_subscriptions: 0,
      total_users: 0,
      total_workspaces: 0,
    };
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    return {
      total_revenue_cents_month: 0,
      total_cost_cents_month: 0,
      active_subscriptions: 0,
      total_users: 0,
      total_workspaces: 0,
    };
  }
}

// ============================================
// Margin Calculations
// ============================================

export interface MarginStats {
  // Totali
  total_calls: number;
  total_minutes: number;
  
  // Revenue (quanto l'utente paga)
  user_paid_cents: number;
  
  // Costi provider AI (Retell/Vapi)
  ai_provider_cost_cents: number;
  
  // Margine
  margin_cents: number;
  margin_percent: number;
  
  // Breakdown per provider
  retell_calls: number;
  retell_cost_cents: number;
  vapi_calls: number;
  vapi_cost_cents: number;
  
  // Costo medio per minuto
  avg_cost_per_minute_cents: number;
}

/**
 * Get margin statistics for the current month
 * 
 * Formula: Margine = Revenue (utente paga) - Costo AI Provider
 * - Revenue = SUM(amount) from cost_events
 * - Costo AI = SUM(call_cost_cents) from calls
 */
export async function getMarginStats(): Promise<MarginStats> {
  try {
    const result = await query<MarginStats>(`
      WITH call_data AS (
        SELECT 
          COUNT(*) as total_calls,
          SUM(duration_ms) / 60000.0 as total_minutes,
          SUM(call_cost_cents) as ai_cost_cents,
          COUNT(*) FILTER (WHERE provider = 'retell') as retell_calls,
          SUM(call_cost_cents) FILTER (WHERE provider = 'retell') as retell_cost,
          COUNT(*) FILTER (WHERE provider = 'vapi') as vapi_calls,
          SUM(call_cost_cents) FILTER (WHERE provider = 'vapi') as vapi_cost
        FROM calls
        WHERE status = 'ended'
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND call_cost_cents IS NOT NULL
      ),
      revenue_data AS (
        SELECT 
          SUM(amount) as user_paid
        FROM cost_events
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        COALESCE(cd.total_calls, 0)::int as total_calls,
        COALESCE(cd.total_minutes, 0)::numeric as total_minutes,
        COALESCE(rd.user_paid, 0)::int as user_paid_cents,
        COALESCE(cd.ai_cost_cents, 0)::int as ai_provider_cost_cents,
        (COALESCE(rd.user_paid, 0) - COALESCE(cd.ai_cost_cents, 0))::int as margin_cents,
        CASE 
          WHEN COALESCE(rd.user_paid, 0) > 0 
          THEN ROUND(100.0 * (COALESCE(rd.user_paid, 0) - COALESCE(cd.ai_cost_cents, 0)) / rd.user_paid, 2)
          ELSE 0 
        END as margin_percent,
        COALESCE(cd.retell_calls, 0)::int as retell_calls,
        COALESCE(cd.retell_cost, 0)::int as retell_cost_cents,
        COALESCE(cd.vapi_calls, 0)::int as vapi_calls,
        COALESCE(cd.vapi_cost, 0)::int as vapi_cost_cents,
        CASE 
          WHEN COALESCE(cd.total_minutes, 0) > 0 
          THEN ROUND(COALESCE(cd.ai_cost_cents, 0) / cd.total_minutes, 2)
          ELSE 0 
        END as avg_cost_per_minute_cents
      FROM call_data cd, revenue_data rd
    `);
    
    return result.rows[0] || {
      total_calls: 0,
      total_minutes: 0,
      user_paid_cents: 0,
      ai_provider_cost_cents: 0,
      margin_cents: 0,
      margin_percent: 0,
      retell_calls: 0,
      retell_cost_cents: 0,
      vapi_calls: 0,
      vapi_cost_cents: 0,
      avg_cost_per_minute_cents: 0,
    };
  } catch (error) {
    console.error('Error fetching margin stats:', error);
    return {
      total_calls: 0,
      total_minutes: 0,
      user_paid_cents: 0,
      ai_provider_cost_cents: 0,
      margin_cents: 0,
      margin_percent: 0,
      retell_calls: 0,
      retell_cost_cents: 0,
      vapi_calls: 0,
      vapi_cost_cents: 0,
      avg_cost_per_minute_cents: 0,
    };
  }
}

export interface CampaignMargin {
  campaign_id: number;
  campaign_name: string;
  locked_cost_per_minute_cents: number;
  total_calls: number;
  total_minutes: number;
  revenue_cents: number;
  ai_cost_cents: number;
  margin_cents: number;
  margin_percent: number;
}

/**
 * Get margin breakdown by campaign
 */
export async function getCampaignMargins(): Promise<CampaignMargin[]> {
  try {
    const result = await query<CampaignMargin>(`
      SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        COALESCE(c.locked_cost_per_minute_cents, 0) as locked_cost_per_minute_cents,
        COUNT(DISTINCT calls.id)::int as total_calls,
        ROUND(SUM(calls.duration_ms) / 60000.0, 2) as total_minutes,
        
        -- Revenue: minuti × prezzo bloccato
        ROUND(SUM(calls.duration_ms) / 60000.0 * COALESCE(c.locked_cost_per_minute_cents, 0))::int as revenue_cents,
        
        -- Costo AI
        COALESCE(SUM(calls.call_cost_cents), 0)::int as ai_cost_cents,
        
        -- Margine
        (ROUND(SUM(calls.duration_ms) / 60000.0 * COALESCE(c.locked_cost_per_minute_cents, 0)) - COALESCE(SUM(calls.call_cost_cents), 0))::int as margin_cents,
        
        -- Margine %
        CASE 
          WHEN SUM(calls.duration_ms) > 0 AND c.locked_cost_per_minute_cents > 0
          THEN ROUND(
            100.0 * (
              SUM(calls.duration_ms) / 60000.0 * c.locked_cost_per_minute_cents - SUM(calls.call_cost_cents)
            ) / (SUM(calls.duration_ms) / 60000.0 * c.locked_cost_per_minute_cents), 
            2
          )
          ELSE 0 
        END as margin_percent

      FROM campaigns c
      JOIN calls ON calls.campaign_id = c.id
      WHERE calls.status = 'ended'
        AND calls.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.id, c.name, c.locked_cost_per_minute_cents
      HAVING COUNT(calls.id) > 0
      ORDER BY margin_cents DESC
      LIMIT 20
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching campaign margins:', error);
    return [];
  }
}

export interface DailyMargin {
  day: string;
  calls: number;
  minutes: number;
  ai_cost_cents: number;
  revenue_cents: number;
  margin_cents: number;
}

/**
 * Get daily margin trend for the last 30 days
 */
export async function getDailyMargins(): Promise<DailyMargin[]> {
  try {
    const result = await query<DailyMargin>(`
      SELECT 
        DATE(calls.created_at)::text as day,
        COUNT(*)::int as calls,
        ROUND(SUM(duration_ms) / 60000.0, 2) as minutes,
        COALESCE(SUM(call_cost_cents), 0)::int as ai_cost_cents,
        
        -- Revenue stimato da campaign locked price
        COALESCE(SUM(
          CASE 
            WHEN calls.campaign_id IS NOT NULL THEN 
              (calls.duration_ms / 60000.0) * (
                SELECT COALESCE(locked_cost_per_minute_cents, 0) 
                FROM campaigns 
                WHERE id = calls.campaign_id
              )
            ELSE 0
          END
        ), 0)::int as revenue_cents,
        
        -- Margine
        (COALESCE(SUM(
          CASE 
            WHEN calls.campaign_id IS NOT NULL THEN 
              (calls.duration_ms / 60000.0) * (
                SELECT COALESCE(locked_cost_per_minute_cents, 0) 
                FROM campaigns 
                WHERE id = calls.campaign_id
              )
            ELSE 0
          END
        ), 0) - COALESCE(SUM(call_cost_cents), 0))::int as margin_cents

      FROM calls
      WHERE status = 'ended' 
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(calls.created_at)
      ORDER BY day DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching daily margins:', error);
    return [];
  }
}

// ============================================
// Cash Flow & Subscription Analytics
// ============================================

export interface CashFlowStats {
  // Revenue
  gross_revenue_cents: number;
  subscription_revenue_cents: number;
  topup_revenue_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  
  // MRR/ARR
  mrr_cents: number;
  arr_cents: number;
  
  // Subscriptions
  active_subscriptions: number;
  trialing_subscriptions: number;
  canceled_this_month: number;
  new_this_month: number;
  churn_rate_percent: number;
  
  // By Plan
  core_subscriptions: number;
  pro_subscriptions: number;
  
  // By Interval
  monthly_subscriptions: number;
  yearly_subscriptions: number;
  
  // Credits
  total_credit_balance_cents: number;
  total_consumption_this_month_cents: number;
}

/**
 * Get comprehensive cash flow and subscription statistics
 */
export async function getCashFlowStats(): Promise<CashFlowStats> {
  try {
    const result = await query<CashFlowStats>(`
      WITH revenue_data AS (
        SELECT 
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose IN ('subscription_invoice', 'topup')) as gross_revenue,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'subscription_invoice') as subscription_revenue,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'topup') as topup_revenue,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund') as refunds
        FROM billing_transaction
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      subscription_data AS (
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_subs,
          COUNT(*) FILTER (WHERE status = 'trialing') as trialing_subs,
          COUNT(*) FILTER (WHERE status = 'canceled' AND updated_at >= DATE_TRUNC('month', CURRENT_DATE)) as canceled_this_month,
          COUNT(*) FILTER (WHERE status = 'active' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)) as new_this_month,
          COUNT(*) FILTER (WHERE status = 'active' AND plan = 'core') as core_subs,
          COUNT(*) FILTER (WHERE status = 'active' AND plan = 'pro') as pro_subs,
          COUNT(*) FILTER (WHERE status = 'active' AND interval = 'month') as monthly_subs,
          COUNT(*) FILTER (WHERE status = 'active' AND interval = 'year') as yearly_subs
        FROM billing_subscription
      ),
      mrr_data AS (
        SELECT COALESCE(SUM(
          CASE 
            WHEN bs.interval = 'year' THEN pc.base_amount_cents / 12
            ELSE pc.base_amount_cents
          END
        ), 0) as mrr_cents
        FROM billing_subscription bs
        LEFT JOIN price_catalog pc ON pc.plan = bs.plan 
                                   AND pc.tier = bs.tier 
                                   AND pc.interval = bs.interval
                                   AND pc.active = true
        WHERE bs.status = 'active'
      ),
      credit_data AS (
        SELECT 
          COALESCE(-SUM(amount), 0) as total_balance,
          COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND ts >= DATE_TRUNC('month', CURRENT_DATE)), 0) as consumption_this_month
        FROM cost_events
      )
      SELECT 
        COALESCE(rd.gross_revenue, 0)::int as gross_revenue_cents,
        COALESCE(rd.subscription_revenue, 0)::int as subscription_revenue_cents,
        COALESCE(rd.topup_revenue, 0)::int as topup_revenue_cents,
        COALESCE(rd.refunds, 0)::int as refunds_cents,
        (COALESCE(rd.gross_revenue, 0) - COALESCE(rd.refunds, 0))::int as net_revenue_cents,
        
        md.mrr_cents::int as mrr_cents,
        (md.mrr_cents * 12)::int as arr_cents,
        
        sd.active_subs::int as active_subscriptions,
        sd.trialing_subs::int as trialing_subscriptions,
        sd.canceled_this_month::int as canceled_this_month,
        sd.new_this_month::int as new_this_month,
        CASE 
          WHEN sd.active_subs > 0 
          THEN ROUND(sd.canceled_this_month::numeric / sd.active_subs * 100, 2)
          ELSE 0 
        END as churn_rate_percent,
        
        sd.core_subs::int as core_subscriptions,
        sd.pro_subs::int as pro_subscriptions,
        sd.monthly_subs::int as monthly_subscriptions,
        sd.yearly_subs::int as yearly_subscriptions,
        
        cd.total_balance::int as total_credit_balance_cents,
        cd.consumption_this_month::int as total_consumption_this_month_cents
        
      FROM revenue_data rd, subscription_data sd, mrr_data md, credit_data cd
    `);
    
    return result.rows[0] || {
      gross_revenue_cents: 0,
      subscription_revenue_cents: 0,
      topup_revenue_cents: 0,
      refunds_cents: 0,
      net_revenue_cents: 0,
      mrr_cents: 0,
      arr_cents: 0,
      active_subscriptions: 0,
      trialing_subscriptions: 0,
      canceled_this_month: 0,
      new_this_month: 0,
      churn_rate_percent: 0,
      core_subscriptions: 0,
      pro_subscriptions: 0,
      monthly_subscriptions: 0,
      yearly_subscriptions: 0,
      total_credit_balance_cents: 0,
      total_consumption_this_month_cents: 0,
    };
  } catch (error) {
    console.error('Error fetching cash flow stats:', error);
    return {
      gross_revenue_cents: 0,
      subscription_revenue_cents: 0,
      topup_revenue_cents: 0,
      refunds_cents: 0,
      net_revenue_cents: 0,
      mrr_cents: 0,
      arr_cents: 0,
      active_subscriptions: 0,
      trialing_subscriptions: 0,
      canceled_this_month: 0,
      new_this_month: 0,
      churn_rate_percent: 0,
      core_subscriptions: 0,
      pro_subscriptions: 0,
      monthly_subscriptions: 0,
      yearly_subscriptions: 0,
      total_credit_balance_cents: 0,
      total_consumption_this_month_cents: 0,
    };
  }
}

export interface MonthlyRevenue {
  month: string;
  gross_revenue_cents: number;
  subscription_revenue_cents: number;
  topup_revenue_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  new_subscriptions: number;
  canceled_subscriptions: number;
}

/**
 * Get monthly revenue trend for the last 12 months
 */
export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  try {
    const result = await query<MonthlyRevenue>(`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
          DATE_TRUNC('month', CURRENT_DATE),
          '1 month'::interval
        )::date as month
      ),
      revenue AS (
        SELECT 
          DATE_TRUNC('month', created_at)::date as month,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose IN ('subscription_invoice', 'topup')) as gross,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'subscription_invoice') as subscription,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'topup') as topup,
          SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund') as refunds
        FROM billing_transaction
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      subs AS (
        SELECT 
          DATE_TRUNC('month', created_at)::date as month,
          COUNT(*) FILTER (WHERE status = 'active') as new_subs
        FROM billing_subscription
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      cancels AS (
        SELECT 
          DATE_TRUNC('month', updated_at)::date as month,
          COUNT(*) as canceled
        FROM billing_subscription
        WHERE status = 'canceled'
          AND updated_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY DATE_TRUNC('month', updated_at)
      )
      SELECT 
        TO_CHAR(m.month, 'YYYY-MM') as month,
        COALESCE(r.gross, 0)::int as gross_revenue_cents,
        COALESCE(r.subscription, 0)::int as subscription_revenue_cents,
        COALESCE(r.topup, 0)::int as topup_revenue_cents,
        COALESCE(r.refunds, 0)::int as refunds_cents,
        (COALESCE(r.gross, 0) - COALESCE(r.refunds, 0))::int as net_revenue_cents,
        COALESCE(s.new_subs, 0)::int as new_subscriptions,
        COALESCE(c.canceled, 0)::int as canceled_subscriptions
      FROM months m
      LEFT JOIN revenue r ON r.month = m.month
      LEFT JOIN subs s ON s.month = m.month
      LEFT JOIN cancels c ON c.month = m.month
      ORDER BY m.month DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    return [];
  }
}

export interface SubscriptionByPlan {
  plan: string;
  tier: string;
  interval: string;
  count: number;
  mrr_contribution_cents: number;
}

/**
 * Get subscription breakdown by plan/tier/interval
 */
export async function getSubscriptionBreakdown(): Promise<SubscriptionByPlan[]> {
  try {
    const result = await query<SubscriptionByPlan>(`
      SELECT 
        bs.plan,
        bs.tier,
        bs.interval,
        COUNT(*)::int as count,
        COALESCE(SUM(
          CASE 
            WHEN bs.interval = 'year' THEN pc.base_amount_cents / 12
            ELSE pc.base_amount_cents
          END
        ), 0)::int as mrr_contribution_cents
      FROM billing_subscription bs
      LEFT JOIN price_catalog pc ON pc.plan = bs.plan 
                                 AND pc.tier = bs.tier 
                                 AND pc.interval = bs.interval
                                 AND pc.active = true
      WHERE bs.status = 'active'
      GROUP BY bs.plan, bs.tier, bs.interval
      ORDER BY mrr_contribution_cents DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching subscription breakdown:', error);
    return [];
  }
}

export interface RevenueByCountry {
  country_code: string;
  gross_revenue_cents: number;
  net_revenue_cents: number;
  subscription_count: number;
  vat_collected_cents: number;
  avg_tax_rate: number;
  transaction_count: number;
}

/**
 * Get revenue breakdown by country with VAT details
 * Uses new billing_country field directly on billing_transaction (v1.1)
 */
export async function getRevenueByCountry(): Promise<RevenueByCountry[]> {
  try {
    const result = await query<RevenueByCountry>(`
      SELECT 
        COALESCE(bt.billing_country, 'UNKNOWN') as country_code,
        COALESCE(SUM(bt.amount_cents) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as gross_revenue_cents,
        COALESCE(SUM(bt.amount_cents - COALESCE(bt.tax_amount_cents, 0)) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as net_revenue_cents,
        COUNT(DISTINCT bs.id) FILTER (WHERE bs.status = 'active')::int as subscription_count,
        COALESCE(SUM(bt.tax_amount_cents) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as vat_collected_cents,
        COALESCE(ROUND(AVG(bt.tax_rate_percent) FILTER (WHERE bt.tax_rate_percent IS NOT NULL), 2), 0) as avg_tax_rate,
        COUNT(bt.id) FILTER (WHERE bt.status = 'paid')::int as transaction_count
      FROM billing_transaction bt
      LEFT JOIN billing_subscription bs ON bs.tenant_id = bt.tenant_id
      WHERE bt.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
      GROUP BY bt.billing_country
      ORDER BY gross_revenue_cents DESC
      LIMIT 20
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching revenue by country:', error);
    return [];
  }
}

export interface TopTenant {
  tenant_id: string;
  total_spent_cents: number;
  subscription_plan: string | null;
  credit_balance_cents: number;
  calls_this_month: number;
}

/**
 * Get top tenants by spend
 */
export async function getTopTenants(): Promise<TopTenant[]> {
  try {
    const result = await query<TopTenant>(`
      WITH tenant_spend AS (
        SELECT 
          tenant_id,
          SUM(amount_cents) FILTER (WHERE status = 'paid') as total_spent
        FROM billing_transaction
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
        GROUP BY tenant_id
      ),
      tenant_credits AS (
        SELECT tenant_id, -SUM(amount) as balance
        FROM cost_events
        GROUP BY tenant_id
      ),
      tenant_calls AS (
        SELECT tenant_id, COUNT(*) as calls
        FROM calls
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY tenant_id
      )
      SELECT 
        ts.tenant_id,
        COALESCE(ts.total_spent, 0)::int as total_spent_cents,
        bs.plan as subscription_plan,
        COALESCE(tc.balance, 0)::int as credit_balance_cents,
        COALESCE(tcl.calls, 0)::int as calls_this_month
      FROM tenant_spend ts
      LEFT JOIN billing_subscription bs ON bs.tenant_id = ts.tenant_id AND bs.status = 'active'
      LEFT JOIN tenant_credits tc ON tc.tenant_id = ts.tenant_id
      LEFT JOIN tenant_calls tcl ON tcl.tenant_id = ts.tenant_id
      ORDER BY ts.total_spent DESC
      LIMIT 20
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching top tenants:', error);
    return [];
  }
}

export interface RecentTransaction {
  id: number;
  tenant_id: string;
  purpose: string;
  amount_cents: number;
  currency: string;
  status: string;
  billing_country: string | null;
  tax_amount_cents: number | null;
  tax_rate_percent: number | null;
  refund_of_transaction_id: number | null;
  created_at: string;
}

/**
 * Get recent transactions with VAT and refund details (v1.1)
 */
export async function getRecentTransactions(limit = 20): Promise<RecentTransaction[]> {
  try {
    const result = await query<RecentTransaction>(`
      SELECT 
        id,
        tenant_id,
        purpose,
        amount_cents,
        currency,
        status,
        billing_country,
        tax_amount_cents,
        tax_rate_percent,
        refund_of_transaction_id,
        created_at::text
      FROM billing_transaction
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }
}

// ============================================
// VAT Report (v1.1)
// ============================================

export interface VATReport {
  country_code: string;
  country_name: string;
  transaction_count: number;
  gross_revenue_cents: number;
  vat_collected_cents: number;
  net_revenue_cents: number;
  avg_tax_rate: number;
  refund_count: number;
  refund_vat_cents: number;
}

/**
 * Get detailed VAT report by country for tax filing
 * Uses new tax_amount_cents and billing_country fields (v1.1)
 */
export async function getVATReport(months = 1): Promise<VATReport[]> {
  try {
    const result = await query<VATReport>(`
      WITH country_names AS (
        SELECT country_code, country_name FROM country_tier
      )
      SELECT 
        COALESCE(bt.billing_country, 'UNKNOWN') as country_code,
        COALESCE(cn.country_name, bt.billing_country, 'Unknown') as country_name,
        COUNT(*) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund')::int as transaction_count,
        COALESCE(SUM(bt.amount_cents) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as gross_revenue_cents,
        COALESCE(SUM(bt.tax_amount_cents) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as vat_collected_cents,
        COALESCE(SUM(bt.amount_cents - COALESCE(bt.tax_amount_cents, 0)) FILTER (WHERE bt.status = 'paid' AND bt.purpose != 'refund'), 0)::int as net_revenue_cents,
        COALESCE(ROUND(AVG(bt.tax_rate_percent) FILTER (WHERE bt.tax_rate_percent IS NOT NULL AND bt.purpose != 'refund'), 2), 0) as avg_tax_rate,
        COUNT(*) FILTER (WHERE bt.purpose = 'refund')::int as refund_count,
        COALESCE(SUM(bt.tax_amount_cents) FILTER (WHERE bt.purpose = 'refund'), 0)::int as refund_vat_cents
      FROM billing_transaction bt
      LEFT JOIN country_names cn ON cn.country_code = bt.billing_country
      WHERE bt.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${months - 1} months'
      GROUP BY bt.billing_country, cn.country_name
      HAVING SUM(bt.amount_cents) FILTER (WHERE bt.status = 'paid') > 0
      ORDER BY gross_revenue_cents DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching VAT report:', error);
    return [];
  }
}

// ============================================
// Refund Analytics (v1.1)
// ============================================

export interface RefundStats {
  total_refunds_cents: number;
  refund_count: number;
  refund_rate_percent: number;
  avg_refund_amount_cents: number;
  refunds_by_reason: { reason: string; count: number; amount_cents: number }[];
}

/**
 * Get refund statistics
 * Uses new refund tracking fields (v1.1)
 */
export async function getRefundStats(): Promise<RefundStats> {
  try {
    const result = await query<{
      total_refunds_cents: number;
      refund_count: number;
      total_revenue_cents: number;
      avg_refund_amount_cents: number;
    }>(`
      SELECT 
        COALESCE(SUM(amount_cents) FILTER (WHERE purpose = 'refund' AND status = 'paid'), 0)::int as total_refunds_cents,
        COUNT(*) FILTER (WHERE purpose = 'refund' AND status = 'paid')::int as refund_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE purpose != 'refund' AND status = 'paid'), 0)::int as total_revenue_cents,
        COALESCE(AVG(amount_cents) FILTER (WHERE purpose = 'refund' AND status = 'paid'), 0)::int as avg_refund_amount_cents
      FROM billing_transaction
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
    `);
    
    const reasonsResult = await query<{ reason: string; count: number; amount_cents: number }>(`
      SELECT 
        COALESCE(refund_reason, 'Not specified') as reason,
        COUNT(*)::int as count,
        COALESCE(SUM(amount_cents), 0)::int as amount_cents
      FROM billing_transaction
      WHERE purpose = 'refund' 
        AND status = 'paid'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
      GROUP BY refund_reason
      ORDER BY amount_cents DESC
    `);
    
    const stats = result.rows[0];
    const refundRate = stats.total_revenue_cents > 0 
      ? (stats.total_refunds_cents / stats.total_revenue_cents) * 100 
      : 0;
    
    return {
      total_refunds_cents: stats.total_refunds_cents,
      refund_count: stats.refund_count,
      refund_rate_percent: Math.round(refundRate * 100) / 100,
      avg_refund_amount_cents: stats.avg_refund_amount_cents,
      refunds_by_reason: reasonsResult.rows,
    };
  } catch (error) {
    console.error('Error fetching refund stats:', error);
    return {
      total_refunds_cents: 0,
      refund_count: 0,
      refund_rate_percent: 0,
      avg_refund_amount_cents: 0,
      refunds_by_reason: [],
    };
  }
}

// ============================================
// Net Revenue with VAT breakdown (v1.1)
// ============================================

export interface NetRevenueBreakdown {
  gross_revenue_cents: number;
  vat_collected_cents: number;
  refunds_cents: number;
  refund_vat_cents: number;
  net_revenue_cents: number;
  net_after_vat_cents: number;
}

/**
 * Get complete revenue breakdown with VAT
 */
export async function getNetRevenueBreakdown(): Promise<NetRevenueBreakdown> {
  try {
    const result = await query<NetRevenueBreakdown>(`
      SELECT 
        -- Gross (all paid non-refund)
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose != 'refund'), 0)::int as gross_revenue_cents,
        -- VAT on revenue
        COALESCE(SUM(tax_amount_cents) FILTER (WHERE status = 'paid' AND purpose != 'refund'), 0)::int as vat_collected_cents,
        -- Refunds
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund'), 0)::int as refunds_cents,
        -- VAT on refunds (to deduct)
        COALESCE(SUM(tax_amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund'), 0)::int as refund_vat_cents,
        -- Net = Gross - Refunds
        (COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose != 'refund'), 0) 
         - COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund'), 0))::int as net_revenue_cents,
        -- Net after VAT = Net - VAT + Refund VAT
        (COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose != 'refund'), 0) 
         - COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund'), 0)
         - COALESCE(SUM(tax_amount_cents) FILTER (WHERE status = 'paid' AND purpose != 'refund'), 0)
         + COALESCE(SUM(tax_amount_cents) FILTER (WHERE status = 'paid' AND purpose = 'refund'), 0))::int as net_after_vat_cents
      FROM billing_transaction
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    return result.rows[0] || {
      gross_revenue_cents: 0,
      vat_collected_cents: 0,
      refunds_cents: 0,
      refund_vat_cents: 0,
      net_revenue_cents: 0,
      net_after_vat_cents: 0,
    };
  } catch (error) {
    console.error('Error fetching net revenue breakdown:', error);
    return {
      gross_revenue_cents: 0,
      vat_collected_cents: 0,
      refunds_cents: 0,
      refund_vat_cents: 0,
      net_revenue_cents: 0,
      net_after_vat_cents: 0,
    };
  }
}
