"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";

interface SLAConfig {
  deliveryConfirmationGraceHours: number;
  delayedShipmentThresholds: Record<string, number>;
  jobIntervalMinutes: number;
  autoTransitions: {
    deliveredToReceived: boolean;
    pendingPaymentToCancel: boolean;
  };
  notifications: {
    onAutoReceived: boolean;
    onDelayedShipment: boolean;
    onSLABreach: boolean;
  };
}

interface JobResult {
  timestamp: string;
  durationMs: number;
  jobs: {
    deliveryConfirmations?: {
      processed: number;
      successful: number;
      failed: number;
    };
    delayedOrders?: {
      flagged: number;
    };
  };
}

interface SchedulerStatus {
  enabled: boolean;
  intervalMinutes: number;
  nextRunEstimate: string | null;
}

export default function SLAAutomationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<SLAConfig | null>(null);
  const [history, setHistory] = useState<JobResult[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/admin");
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const configRes = await api.get("/sla-jobs/config");
      const configData = configRes.data;
      setConfig(configData.config);
      setSchedulerStatus(configData.schedulerStatus);

      const historyRes = await api.get("/sla-jobs/history");
      const historyData = historyRes.data;
      setHistory(historyData.history || []);
      if (historyData.config) {
        setSchedulerStatus({
          enabled: historyData.config.schedulerEnabled,
          intervalMinutes: historyData.config.intervalMinutes,
          nextRunEstimate: historyData.config.nextRunEstimate,
        });
      }
    } catch (error) {
      console.error("Failed to fetch SLA data:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerJob = async () => {
    try {
      setActionLoading(true);
      const res = await api.post("/sla-jobs/trigger");
      const data = res.data;
      alert(`Job executed successfully!\nDeliveries: ${data.results.jobs.deliveryConfirmations?.successful || 0}\nDelayed: ${data.results.jobs.delayedOrders?.flagged || 0}`);
      await fetchData();
    } catch (error) {
      console.error("Failed to trigger job:", error);
      alert("Failed to trigger job");
    } finally {
      setActionLoading(false);
    }
  };

  const controlScheduler = async (action: "start" | "stop") => {
    try {
      setActionLoading(true);
      await api.post("/sla-jobs/scheduler", { action });
      await fetchData();
    } catch (error) {
      console.error("Failed to control scheduler:", error);
      alert("Failed to control scheduler");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title="SLA Automation">
        <div className="p-8">Loading...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="SLA Automation">
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-black/10 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
            <h1 className="text-3xl font-semibold text-black md:text-4xl">SLA Automation & Jobs</h1>
            <p className="mt-2 text-sm text-black/65">Control scheduler automation, view SLA thresholds, and inspect job execution history.</p>
          </section>

          {/* Scheduler Control */}
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Scheduler Status</h2>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      schedulerStatus?.enabled ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-lg font-medium text-black/85">
                    {schedulerStatus?.enabled ? "Running" : "Stopped"}
                  </span>
                </div>
                {schedulerStatus?.enabled && schedulerStatus.nextRunEstimate && (
                  <p className="mt-2 text-sm text-black/55">
                    Next run: {new Date(schedulerStatus.nextRunEstimate).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={triggerJob}
                  disabled={actionLoading}
                  className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                >
                  {actionLoading ? "Running..." : "Run Now"}
                </button>
                {schedulerStatus?.enabled ? (
                  <button
                    onClick={() => controlScheduler("stop")}
                    disabled={actionLoading}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    Stop Scheduler
                  </button>
                ) : (
                  <button
                    onClick={() => controlScheduler("start")}
                    disabled={actionLoading}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Start Scheduler
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Display */}
          {config && (
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                  <h3 className="mb-2 font-medium text-black/70">Auto-Transitions</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      Delivered → Received:{" "}
                      <span
                        className={
                          config.autoTransitions.deliveredToReceived
                            ? "text-green-600 font-medium"
                            : "text-gray-400"
                        }
                      >
                        {config.autoTransitions.deliveredToReceived ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="text-xs text-black/50">
                      Grace period: {config.deliveryConfirmationGraceHours} hours
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                  <h3 className="mb-2 font-medium text-black/70">Delayed Shipment Thresholds</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(config.delayedShipmentThresholds).map(([status, hours]) => (
                      <div key={status}>
                        {status}: <span className="font-medium">{hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                  <h3 className="mb-2 font-medium text-black/70">Notifications</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      Auto-received:{" "}
                      {config.notifications.onAutoReceived ? "✓ Enabled" : "✗ Disabled"}
                    </div>
                    <div>
                      Delayed shipment:{" "}
                      {config.notifications.onDelayedShipment ? "✓ Enabled" : "✗ Disabled"}
                    </div>
                    <div>
                      SLA breach: {config.notifications.onSLABreach ? "✓ Enabled" : "✗ Disabled"}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-black/2 p-4">
                  <h3 className="mb-2 font-medium text-black/70">Job Schedule</h3>
                  <div className="text-sm">
                    Interval: <span className="font-medium">{config.jobIntervalMinutes} minutes</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Job Execution History */}
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Execution History</h2>
            {history.length === 0 ? (
              <p className="text-black/55">No job history yet. Trigger a job or wait for automatic run.</p>
            ) : (
              <div className="space-y-4">
                {history.slice(0, 10).map((job, idx) => (
                  <div key={idx} className="rounded-xl border border-black/10 bg-black/2 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          {new Date(job.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-black/55">
                          Duration: {job.durationMs}ms
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {job.jobs.deliveryConfirmations && (
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="font-medium text-blue-900">Auto-Confirmations</p>
                          <p className="text-blue-700">
                            ✓ {job.jobs.deliveryConfirmations.successful} /{" "}
                            {job.jobs.deliveryConfirmations.processed}
                          </p>
                          {job.jobs.deliveryConfirmations.failed > 0 && (
                            <p className="text-red-600 text-xs">
                              ✗ {job.jobs.deliveryConfirmations.failed} failed
                            </p>
                          )}
                        </div>
                      )}
                      {job.jobs.delayedOrders && (
                        <div className="bg-amber-50 p-3 rounded">
                          <p className="font-medium text-amber-900">Delayed Orders</p>
                          <p className="text-amber-700">
                            🚩 {job.jobs.delayedOrders.flagged} flagged
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
