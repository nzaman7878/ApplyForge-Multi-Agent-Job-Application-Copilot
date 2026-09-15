const Application = require('../models/Application');

/**
 * Helper: extracts numeric score from polymorphic fitScore field
 */
function extractScore(fitScore) {
  if (typeof fitScore === 'number' && !isNaN(fitScore)) {
    return fitScore;
  }
  if (fitScore && typeof fitScore.score === 'number' && !isNaN(fitScore.score)) {
    return fitScore.score;
  }
  return null;
}

/**
 * Helper: checks if an application received a response/callback
 * (moved to interviewing or offer currently or at any point in history)
 */
function checkHasResponse(app) {
  if (app.status === 'interviewing' || app.status === 'offer') {
    return true;
  }
  if (Array.isArray(app.statusHistory)) {
    return app.statusHistory.some((h) => h.status === 'interviewing' || h.status === 'offer');
  }
  return false;
}

/**
 * Helper: get Monday 00:00:00 UTC for a given date
 */
function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * GET /api/analytics/summary
 * Returns overall CRM metrics: total applications, by-status counts, response rate, avg fit score
 */
const getSummary = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applications = await Application.find({ userId }).lean();

    const total = applications.length;

    const byStatus = {
      wishlist: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
    };

    let submittedCount = 0;
    let responseCount = 0;
    let offerCount = 0;
    const scores = [];

    for (const app of applications) {
      if (byStatus[app.status] !== undefined) {
        byStatus[app.status]++;
      }

      const isSubmitted = app.status !== 'wishlist';
      if (isSubmitted) {
        submittedCount++;
      }

      if (checkHasResponse(app)) {
        responseCount++;
      }

      if (
        app.status === 'offer' ||
        (Array.isArray(app.statusHistory) && app.statusHistory.some((h) => h.status === 'offer'))
      ) {
        offerCount++;
      }

      const score = extractScore(app.fitScore);
      if (score !== null) {
        scores.push(score);
      }
    }

    const responseRate =
      submittedCount > 0 ? Number(((responseCount / submittedCount) * 100).toFixed(1)) : 0;

    const offerRate =
      submittedCount > 0 ? Number(((offerCount / submittedCount) * 100).toFixed(1)) : 0;

    const avgFitScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, val) => sum + val, 0) / scores.length)
        : 0;

    return res.status(200).json({
      summary: {
        total,
        byStatus,
        submittedCount,
        responseCount,
        responseRate,
        offerCount,
        offerRate,
        avgFitScore,
        scoredApplicationsCount: scores.length,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve analytics summary',
    });
  }
};

/**
 * GET /api/analytics/timeline
 * Applications per week over the last 12 weeks
 */
const getTimeline = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applications = await Application.find({ userId }).lean();

    // Generate 12 calendar week intervals ending with the current week
    const now = new Date();
    const currentWeekStart = getStartOfWeek(now);
    const weeks = [];

    const MONTH_NAMES = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    for (let i = 11; i >= 0; i--) {
      const start = new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const label = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()}`;

      weeks.push({
        weekIndex: 11 - i,
        label,
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        count: 0,
        byStatus: {
          wishlist: 0,
          applied: 0,
          interviewing: 0,
          offer: 0,
          rejected: 0,
        },
      });
    }

    let totalInPeriod = 0;

    // Distribute applications into the appropriate week bucket
    for (const app of applications) {
      const appDate = new Date(app.appliedAt || app.createdAt);
      const appTime = appDate.getTime();

      for (const week of weeks) {
        const startTime = new Date(week.weekStart).getTime();
        const endTime = new Date(week.weekEnd).getTime();

        if (appTime >= startTime && appTime <= endTime) {
          week.count++;
          totalInPeriod++;
          if (week.byStatus[app.status] !== undefined) {
            week.byStatus[app.status]++;
          }
          break;
        }
      }
    }

    return res.status(200).json({
      timeline: weeks,
      totalApplicationsInPeriod: totalInPeriod,
      totalApplicationsOverall: applications.length,
    });
  } catch (error) {
    console.error('Error fetching analytics timeline:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve analytics timeline',
    });
  }
};

/**
 * GET /api/analytics/score-vs-response
 * Fit score bands vs callback rate
 */
const getScoreVsResponse = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applications = await Application.find({ userId }).lean();

    const bands = [
      {
        band: '0-59',
        label: '0–59 (Stretch)',
        tier: 'stretch',
        minScore: 0,
        maxScore: 59,
        total: 0,
        responses: 0,
        responseRate: 0,
      },
      {
        band: '60-74',
        label: '60–74 (Moderate)',
        tier: 'moderate',
        minScore: 60,
        maxScore: 74,
        total: 0,
        responses: 0,
        responseRate: 0,
      },
      {
        band: '75-84',
        label: '75–84 (Good)',
        tier: 'moderate',
        minScore: 75,
        maxScore: 84,
        total: 0,
        responses: 0,
        responseRate: 0,
      },
      {
        band: '85-100',
        label: '85–100 (Strong)',
        tier: 'strong',
        minScore: 85,
        maxScore: 100,
        total: 0,
        responses: 0,
        responseRate: 0,
      },
    ];

    const tiers = {
      stretch: { label: 'Stretch (<60)', minScore: 0, maxScore: 59, total: 0, responses: 0, responseRate: 0 },
      moderate: { label: 'Moderate (60–79)', minScore: 60, maxScore: 79, total: 0, responses: 0, responseRate: 0 },
      strong: { label: 'Strong (80–100)', minScore: 80, maxScore: 100, total: 0, responses: 0, responseRate: 0 },
    };

    let unscoredCount = 0;

    for (const app of applications) {
      const score = extractScore(app.fitScore);
      if (score === null) {
        unscoredCount++;
        continue;
      }

      const hasResponse = checkHasResponse(app);

      // Distribute to bands
      for (const b of bands) {
        if (score >= b.minScore && score <= b.maxScore) {
          b.total++;
          if (hasResponse) {
            b.responses++;
          }
          break;
        }
      }

      // Distribute to 3 tiers
      if (score < 60) {
        tiers.stretch.total++;
        if (hasResponse) tiers.stretch.responses++;
      } else if (score < 80) {
        tiers.moderate.total++;
        if (hasResponse) tiers.moderate.responses++;
      } else {
        tiers.strong.total++;
        if (hasResponse) tiers.strong.responses++;
      }
    }

    // Calculate response rates
    for (const b of bands) {
      b.responseRate = b.total > 0 ? Number(((b.responses / b.total) * 100).toFixed(1)) : 0;
    }

    for (const key of Object.keys(tiers)) {
      const t = tiers[key];
      t.responseRate = t.total > 0 ? Number(((t.responses / t.total) * 100).toFixed(1)) : 0;
    }

    return res.status(200).json({
      bands,
      tiers,
      unscoredCount,
      totalScored: applications.length - unscoredCount,
    });
  } catch (error) {
    console.error('Error fetching score vs response analytics:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to retrieve score vs response analytics',
    });
  }
};

module.exports = {
  getSummary,
  getTimeline,
  getScoreVsResponse,
  extractScore,
  checkHasResponse,
  getStartOfWeek,
};
