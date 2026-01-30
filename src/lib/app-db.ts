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
