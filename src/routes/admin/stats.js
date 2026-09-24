import { adminLayout } from '../../templates/admin/layout.js';
import { statsPage } from '../../templates/admin/stats.js';
import { canberraDayKey } from '../../lib/dates.js';

const METRICS = ['home_view', 'event_view', 'calendar_view', 'ticket_click', 'ics_feed_fetch', 'ics_event_download', 'submission', 'contact_message'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function handleStats(request, env, admin) {
  const since30 = canberraDayKey(new Date(Date.now() - THIRTY_DAYS_MS).toISOString());

  // One pass over daily_counts for every metric's two totals, rather than
  // two queries per metric.
  const { results: sums } = await env.DB.prepare(
    `SELECT metric, SUM(CASE WHEN day >= ? THEN count ELSE 0 END) AS last30, SUM(count) AS allTime
     FROM daily_counts GROUP BY metric`,
  ).bind(since30).all();
  const byMetric = new Map(sums.map((row) => [row.metric, row]));
  const totals = METRICS.map((metric) => ({
    metric,
    last30: byMetric.get(metric)?.last30 ?? 0,
    allTime: byMetric.get(metric)?.allTime ?? 0,
  }));

  const { results: topByViews } = await env.DB.prepare(
    `SELECT events.title, events.slug, SUM(daily_counts.count) AS count
     FROM daily_counts JOIN events ON events.id = daily_counts.subject_id
     WHERE daily_counts.metric = 'event_view'
     GROUP BY daily_counts.subject_id ORDER BY count DESC LIMIT 10`,
  ).all();

  const { results: topByClicks } = await env.DB.prepare(
    `SELECT events.title, events.slug, SUM(daily_counts.count) AS count
     FROM daily_counts JOIN events ON events.id = daily_counts.subject_id
     WHERE daily_counts.metric = 'ticket_click'
     GROUP BY daily_counts.subject_id ORDER BY count DESC LIMIT 10`,
  ).all();

  const { results: perCrew } = await env.DB.prepare(
    `SELECT crews.name AS name,
       COALESCE(SUM(CASE WHEN daily_counts.metric = 'event_view' THEN daily_counts.count ELSE 0 END), 0) AS views,
       COALESCE(SUM(CASE WHEN daily_counts.metric = 'ticket_click' THEN daily_counts.count ELSE 0 END), 0) AS clicks
     FROM crews
     JOIN events ON events.crew_id = crews.id
     LEFT JOIN daily_counts ON daily_counts.subject_id = events.id AND daily_counts.metric IN ('event_view', 'ticket_click')
     GROUP BY crews.id ORDER BY crews.name`,
  ).all();

  const body = statsPage(totals, topByViews, topByClicks, perCrew);
  return new Response(String(adminLayout({ title: 'Stats', bodyContent: body, email: admin.email, path: admin.path, siteOrigin: admin.siteOrigin })), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
