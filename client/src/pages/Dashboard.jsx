import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { KPICardsGrid, RecentApplications } from '../components/dashboard';
import {
  TimelineChart,
  StatusDonut,
  ScoreVsResponseBar,
} from '../components/charts';
import { FollowUpBanner } from '../components/tracker';
import api from '../lib/axios';
import { useToast } from '../hooks/useToast';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Analytics & CRM Data
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [scoreData, setScoreData] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [dueFollowUps, setDueFollowUps] = useState([]);
  const [dueCount, setDueCount] = useState(0);

  /**
   * Fetch all dashboard data
   */
  const loadDashboardData = useCallback(async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);

      const [
        summaryRes,
        timelineRes,
        scoreRes,
        recentAppsRes,
        followUpsRes,
      ] = await Promise.allSettled([
        api.get('/api/analytics/summary'),
        api.get('/api/analytics/timeline'),
        api.get('/api/analytics/score-vs-response'),
        api.get('/api/applications?limit=6'),
        api.get('/api/applications/follow-ups/due'),
      ]);

      // 1. Summary
      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data?.summary) {
        setSummary(summaryRes.value.data.summary);
      }

      // 2. Timeline
      if (timelineRes.status === 'fulfilled' && timelineRes.value?.data?.timeline) {
        setTimeline(timelineRes.value.data.timeline);
      }

      // 3. Score vs Response
      if (scoreRes.status === 'fulfilled' && scoreRes.value?.data) {
        setScoreData(scoreRes.value.data);
      }

      // 4. Recent Applications
      if (
        recentAppsRes.status === 'fulfilled' &&
        recentAppsRes.value?.data?.applications
      ) {
        setRecentApplications(recentAppsRes.value.data.applications);
      }

      // 5. Due Follow-ups
      if (followUpsRes.status === 'fulfilled') {
        const data = followUpsRes.value.data;
        const dueList = data?.dueFollowUps || data?.applications || [];
        setDueFollowUps(dueList);
        setDueCount(data?.count !== undefined ? data.count : dueList.length);
      }

      if (showToast) {
        toast.success('Dashboard telemetry updated');
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching analytics data:', error);
      if (showToast) {
        toast.error('Failed to update dashboard telemetry');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const [
          summaryRes,
          timelineRes,
          scoreRes,
          recentAppsRes,
          followUpsRes,
        ] = await Promise.allSettled([
          api.get('/api/analytics/summary'),
          api.get('/api/analytics/timeline'),
          api.get('/api/analytics/score-vs-response'),
          api.get('/api/applications?limit=6'),
          api.get('/api/applications/follow-ups/due'),
        ]);

        if (!isMounted) return;

        if (summaryRes.status === 'fulfilled' && summaryRes.value?.data?.summary) {
          setSummary(summaryRes.value.data.summary);
        }
        if (timelineRes.status === 'fulfilled' && timelineRes.value?.data?.timeline) {
          setTimeline(timelineRes.value.data.timeline);
        }
        if (scoreRes.status === 'fulfilled' && scoreRes.value?.data) {
          setScoreData(scoreRes.value.data);
        }
        if (
          recentAppsRes.status === 'fulfilled' &&
          recentAppsRes.value?.data?.applications
        ) {
          setRecentApplications(recentAppsRes.value.data.applications);
        }
        if (followUpsRes.status === 'fulfilled') {
          const data = followUpsRes.value.data;
          const dueList = data?.dueFollowUps || data?.applications || [];
          setDueFollowUps(dueList);
          setDueCount(data?.count !== undefined ? data.count : dueList.length);
        }
      } catch (error) {
        console.error('[Dashboard] Initial fetch error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      isMounted = false;
    };
  }, []);



  /**
   * Optimistic follow-up date change on recent applications
   */
  const handleMarkFollowUp = async (applicationId, nextFollowUpDate) => {
    const target = recentApplications.find(
      (app) => (app.id || app._id) === applicationId
    );
    if (!target) return;

    const previousNext = target.nextFollowUpAt;

    setRecentApplications((prev) =>
      prev.map((app) =>
        (app.id || app._id) === applicationId
          ? { ...app, nextFollowUpAt: nextFollowUpDate, isOverdue: false }
          : app
      )
    );

    try {
      await api.patch(`/api/applications/${applicationId}`, {
        nextFollowUpAt: nextFollowUpDate,
        ...(nextFollowUpDate === null ? { lastFollowUpAt: new Date().toISOString() } : {}),
      });

      if (nextFollowUpDate === null) {
        toast.success(`Cleared follow-up reminder for ${target.company}`);
      } else {
        toast.success(`Follow-up scheduled for ${target.company}`);
      }

      // Re-fetch due follow-ups to maintain banner state
      api.get('/api/applications/follow-ups/due').then((res) => {
        const list = res.data?.dueFollowUps || res.data?.applications || [];
        setDueFollowUps(list);
        setDueCount(res.data?.count !== undefined ? res.data.count : list.length);
      });
    } catch (err) {
      console.error('[Dashboard] Follow-up update failed:', err);
      toast.error('Failed to schedule follow-up');
      setRecentApplications((prev) =>
        prev.map((app) =>
          (app.id || app._id) === applicationId
            ? { ...app, nextFollowUpAt: previousNext }
            : app
        )
      );
    }
  };

  // Derive top-level metric values
  const totalApplied = summary?.submittedCount ?? summary?.total ?? 0;
  const responseRate = summary?.responseRate ?? 0;
  const avgFitScore = summary?.avgFitScore ?? 0;
  const openFollowUps = dueCount;

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        {/* ================================================================= */}
        {/* Top Header & Quick Actions                                        */}
        {/* ================================================================= */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Executive Dashboard
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Real-time recruitment pipeline overview, AI tailoring quality benchmarks, and outreach velocity.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadDashboardData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 transition shadow-sm disabled:opacity-50"
              title="Refresh telemetry"
            >
              <svg
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            {/* Tracker Navigation */}
            <Link
              to="/tracker"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-850 hover:border-slate-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 transition border border-slate-700/80 shadow-sm"
            >
              <span>📋</span>
              <span>Tracker Board</span>
            </Link>

            {/* New Application CTA */}
            <Link
              to="/apply"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs sm:text-sm font-semibold text-white transition shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
            >
              <span>✨</span>
              <span>New Application</span>
            </Link>
          </div>
        </header>

        {/* ================================================================= */}
        {/* Due Follow-ups Banner (Surfaced if reminders are pending)         */}
        {/* ================================================================= */}
        {dueFollowUps.length > 0 && (
          <FollowUpBanner
            dueApplications={dueFollowUps}
            onMarkFollowedUp={handleMarkFollowUp}
            onSnooze={handleMarkFollowUp}
          />
        )}

        {/* ================================================================= */}
        {/* Top: KPI Stat Cards Grid (Total, Response Rate, Fit Score, Due)   */}
        {/* ================================================================= */}
        <section aria-label="Key Performance Indicators">
          <KPICardsGrid
            totalApplied={totalApplied}
            responseRate={responseRate}
            avgFitScore={avgFitScore}
            openFollowUps={openFollowUps}
            trends={{
              totalApplied: { value: '+12%', direction: 'up', period: 'vs previous month' },
              responseRate: { value: '+4.5%', direction: 'up', period: 'vs previous month' },
              avgFitScore: { value: '+3.2%', direction: 'up', period: 'vs previous month' },
              openFollowUps: {
                value: openFollowUps > 0 ? `${openFollowUps} due` : 'None due',
                direction: openFollowUps > 0 ? 'up' : 'neutral',
                period: 'requires action',
                isPositiveGood: false,
              },
            }}
            isLoading={isLoading}
            onCardClick={(cardKey) => {
              if (cardKey === 'totalApplied' || cardKey === 'openFollowUps') {
                navigate('/tracker');
              }
            }}
          />
        </section>

        {/* ================================================================= */}
        {/* Middle: Charts Grid (Responsive: 3-col desktop, 1-col mobile)    */}
        {/* ================================================================= */}
        <section
          aria-label="Analytics and Visualizations"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Chart 1: Applications Timeline (Velocity) */}
          <div className="h-full">
            <TimelineChart
              data={timeline}
              isLoading={isLoading}
              height={320}
              title="Submission Velocity"
              subtitle="Weekly application cadence over 12 weeks"
            />
          </div>

          {/* Chart 2: Status Distribution Donut */}
          <div className="h-full">
            <StatusDonut
              data={summary?.byStatus}
              explicitTotal={totalApplied}
              isLoading={isLoading}
              height={320}
              title="Pipeline Stage Distribution"
              subtitle="Applications partitioned by current stage"
            />
          </div>

          {/* Chart 3: Fit Score vs Response Rate Bar Chart */}
          <div className="h-full">
            <ScoreVsResponseBar
              data={scoreData}
              applications={recentApplications}
              isLoading={isLoading}
              height={320}
              title="Fit Score vs Response Rate"
              subtitle="Tailoring alignment vs callback probability"
            />
          </div>
        </section>

        {/* ================================================================= */}
        {/* Bottom: Recent Applications Panel (Last 5)                        */}
        {/* ================================================================= */}
        <section aria-label="Recent Applications">
          <RecentApplications
            applications={recentApplications}
            isLoading={isLoading}
            maxItems={5}
          />
        </section>
      </main>
    </AppLayout>
  );
}
