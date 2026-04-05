const { runSLAJobs } = require("../services/orderSLAService");
const slaConfig = require("../config/sla");
const { SLAJobRun, sequelize } = require("../models");
const os = require("os");
const {
  incrementMetric,
  getMetricsSnapshot,
  logInfo,
  logWarn,
  logError,
} = require("../services/observabilityService");

const MAX_HISTORY = 50;
const SCHEDULER_LOCK_KEY = 84124517;
const instanceId = `${os.hostname()}:${process.pid}`;

// Store scheduler status
let schedulerInterval = null;
let schedulerEnabled = false;

const toBoolean = (value) => value === true || value === "t" || value === 1 || value === "1";

const toHistoryItem = (run) => ({
  timestamp: (run.finishedAt || run.createdAt || new Date()).toISOString(),
  durationMs: run.durationMs || 0,
  jobs: run.results?.jobs || {},
  status: run.status,
  triggerSource: run.triggerSource,
  error: run.error || null,
  instanceId: run.instanceId || null,
});

/**
 * Executes SLA jobs under a transaction-scoped advisory lock so only one instance runs at a time.
 */
const executeSLAJobs = async ({ triggerSource, skipWhenLocked = false }) => {
  const startedAt = new Date();
  const lockTx = await sequelize.transaction();

  try {
    const [lockRows] = await sequelize.query(
      "SELECT pg_try_advisory_xact_lock(:lockKey) AS locked",
      {
        replacements: { lockKey: SCHEDULER_LOCK_KEY },
        transaction: lockTx,
      }
    );

    const locked = toBoolean(lockRows?.[0]?.locked);
    if (!locked) {
      await lockTx.rollback();

      incrementMetric("scheduler.lock_skips", 1, {
        triggerSource,
      });
      logWarn("scheduler.lock_not_acquired", {
        triggerSource,
        instanceId,
      });

      if (skipWhenLocked) {
        return {
          skipped: true,
          reason: "lock_not_acquired",
        };
      }

      const lockError = new Error("Another instance is currently running SLA automation jobs.");
      lockError.code = "LOCK_NOT_ACQUIRED";
      throw lockError;
    }

    const results = await runSLAJobs();
    const finishedAt = new Date();

    const persistedRun = await SLAJobRun.create({
      triggerSource,
      status: "success",
      durationMs: results.durationMs || finishedAt.getTime() - startedAt.getTime(),
      results,
      error: null,
      startedAt,
      finishedAt,
      instanceId,
    });

    await lockTx.commit();

    return {
      skipped: false,
      run: persistedRun,
      results,
    };
  } catch (error) {
    if (!lockTx.finished) {
      await lockTx.rollback();
    }

    // Do not record lock contention as a failed job run.
    if (error.code === "LOCK_NOT_ACQUIRED") {
      throw error;
    }

    const finishedAt = new Date();
    try {
      await SLAJobRun.create({
        triggerSource,
        status: "failed",
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        results: null,
        error: error.message,
        startedAt,
        finishedAt,
        instanceId,
      });
    } catch (persistError) {
      console.error("Failed to persist SLA job failure run:", persistError);
    }

    throw error;
  }
};

const runSchedulerTick = async (reason = "interval") => {
  try {
    const execution = await executeSLAJobs({
      triggerSource: "scheduler",
      skipWhenLocked: true,
    });

    if (execution.skipped) {
      console.log(`⏭️  Skipping scheduler tick (${reason}): lock is held by another instance.`);
      logInfo("scheduler.tick_skipped", {
        reason,
        skipReason: execution.reason || "lock_not_acquired",
      });
    }
  } catch (error) {
    incrementMetric("scheduler.tick_errors", 1);
    logError("scheduler.tick_failed", { reason }, error);
    console.error("Scheduled SLA job failed:", error);
  }
};

/**
 * Manually trigger SLA jobs
 */
const triggerJobs = async (req, res) => {
  try {
    const execution = await executeSLAJobs({
      triggerSource: "manual",
      skipWhenLocked: false,
    });

    res.json({
      message: "SLA jobs executed successfully",
      results: execution.results,
      runId: execution.run.id,
    });
  } catch (error) {
    if (error.code === "LOCK_NOT_ACQUIRED") {
      return res.status(409).json({
        error: "SLA jobs are already running on another instance.",
      });
    }

    console.error("SLA job execution failed:", error);
    return res.status(500).json({
      error: "Failed to execute SLA jobs",
      details: error.message,
    });
  }
};

/**
 * Get job execution history
 */
const getJobHistory = async (req, res) => {
  try {
    const runs = await SLAJobRun.findAll({
      limit: MAX_HISTORY,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      history: runs.map(toHistoryItem),
      config: {
        intervalMinutes: slaConfig.jobIntervalMinutes,
        schedulerEnabled,
        nextRunEstimate: schedulerEnabled
          ? new Date(Date.now() + slaConfig.jobIntervalMinutes * 60 * 1000).toISOString()
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to load SLA job history:", error);
    return res.status(500).json({
      error: "Failed to fetch SLA job history",
      details: error.message,
    });
  }
};

/**
 * Get current SLA configuration
 */
const getConfig = (req, res) => {
  return res.json({
    config: slaConfig,
    schedulerStatus: {
      enabled: schedulerEnabled,
      intervalMinutes: slaConfig.jobIntervalMinutes,
      nextRunEstimate: schedulerEnabled
        ? new Date(Date.now() + slaConfig.jobIntervalMinutes * 60 * 1000).toISOString()
        : null,
    },
  });
};

/**
 * Get observability metrics snapshot
 */
const getObservabilityMetrics = (req, res) => {
  return res.json({
    timestamp: new Date().toISOString(),
    metrics: getMetricsSnapshot(),
  });
};

/**
 * Start the job scheduler
 */
const startScheduler = () => {
  if (schedulerInterval) {
    console.log("⚠️  Scheduler already running");
    return;
  }

  const intervalMs = slaConfig.jobIntervalMinutes * 60 * 1000;

  console.log(`🚀 Starting SLA job scheduler (every ${slaConfig.jobIntervalMinutes} minutes)`);

  // Run immediately on start
  runSchedulerTick("startup");

  // Then run on interval
  schedulerInterval = setInterval(async () => {
    runSchedulerTick("interval");
  }, intervalMs);

  schedulerEnabled = true;
};

/**
 * Stop the job scheduler
 */
const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    schedulerEnabled = false;
    console.log("🛑 SLA job scheduler stopped");
  }
};

/**
 * Control scheduler (start/stop)
 */
const controlScheduler = (req, res) => {
  const { action } = req.body;

  if (action === "start") {
    startScheduler();
    return res.json({ message: "Scheduler started", enabled: true });
  } else if (action === "stop") {
    stopScheduler();
    return res.json({ message: "Scheduler stopped", enabled: false });
  } else {
    return res.status(400).json({ error: "Invalid action. Use 'start' or 'stop'" });
  }
};

module.exports = {
  triggerJobs,
  getJobHistory,
  getConfig,
  getObservabilityMetrics,
  startScheduler,
  stopScheduler,
  controlScheduler,
};
