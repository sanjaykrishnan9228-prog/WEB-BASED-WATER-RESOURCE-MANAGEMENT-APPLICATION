
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Atom,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  CircleHelp,
  Clock3,
  Download,
  Droplets,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Thermometer,
  Wind,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

type Page =
  | "Overview"
  | "Electrolyzers"
  | "Production"
  | "Resources"
  | "Alerts"
  | "Reports"
  | "Settings";

type MachineStatus = "All" | "Running" | "Warning" | "Standby";
type Severity = "info" | "warning" | "critical";

type Machine = {
  id: string;
  name: string;
  type: string;
  status: Exclude<MachineStatus, "All">;
  temp: string;
  pressure: string;
  load: number;
  color: string;
};

type ProductionData = {
  id: number;
  hydrogen_kg: number | string;
  target_kg: number | string;
  production_rate: number | string;
  recorded_at: string;
};

type ResourceData = {
  id: number;
  power_kwh: number | string;
  water_litres: number | string;
  efficiency: number | string;
  recorded_at: string;
};

type AlertData = {
  id: number;
  title: string;
  detail: string | null;
  severity: Severity;
  is_resolved: boolean;
  created_at: string;
};

type DisplayAlert = {
  id: number;
  title: string;
  detail: string;
  time: string;
  type: Severity | "success";
  isResolved?: boolean;
  isDemo?: boolean;
};

const API = "http://localhost:5001/api";

const productionChart = [
  { time: "06 AM", hydrogen: 18, target: 20 },
  { time: "08 AM", hydrogen: 26, target: 25 },
  { time: "10 AM", hydrogen: 34, target: 32 },
  { time: "12 PM", hydrogen: 30, target: 35 },
  { time: "02 PM", hydrogen: 43, target: 40 },
  { time: "04 PM", hydrogen: 48, target: 45 },
  { time: "06 PM", hydrogen: 40, target: 42 },
];

const resourceChart = [
  { day: "Mon", power: 68, water: 42 },
  { day: "Tue", power: 82, water: 55 },
  { day: "Wed", power: 74, water: 48 },
  { day: "Thu", power: 92, water: 65 },
  { day: "Fri", power: 78, water: 51 },
  { day: "Sat", power: 60, water: 39 },
  { day: "Sun", power: 85, water: 58 },
];

const demoAlerts: DisplayAlert[] = [
  {
    id: -1,
    title: "High temperature detected",
    detail: "Electrolyzer Gamma · 82.6°C",
    time: "Demo notification",
    type: "warning",
    isDemo: true,
  },
  {
    id: -2,
    title: "Production target achieved",
    detail: "Daily production milestone",
    time: "Demo notification",
    type: "success",
    isDemo: true,
  },
  {
    id: -3,
    title: "Maintenance scheduled",
    detail: "Electrolyzer Delta · Routine check",
    time: "Demo notification",
    type: "info",
    isDemo: true,
  },
];

const navItems = [
  { label: "Overview" as Page, icon: LayoutDashboard },
  { label: "Electrolyzers" as Page, icon: Atom },
  { label: "Production" as Page, icon: FlaskConical },
  { label: "Resources" as Page, icon: Droplets },
  { label: "Alerts" as Page, icon: Bell },
  { label: "Reports" as Page, icon: Activity },
  { label: "Settings" as Page, icon: Settings },
];

const num = (
  value: number | string | undefined,
  fallback: number,
) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fmt = (value: number, digits = 1) =>
  value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });

const machineColor = (status: string, index: number) =>
  status === "Warning"
    ? "orange"
    : status === "Running"
      ? index % 2 === 0
        ? "green"
        : "blue"
      : "purple";

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [machinesError, setMachinesError] = useState("");

  const [productionData, setProductionData] =
    useState<ProductionData | null>(null);
  const [resourceData, setResourceData] =
    useState<ResourceData | null>(null);
  const [apiAlerts, setApiAlerts] = useState<AlertData[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const [demoAlertsVisible, setDemoAlertsVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<MachineStatus>("All");
  const [period, setPeriod] = useState("Today");
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [productionForm, setProductionForm] = useState({
    hydrogen_kg: "",
    target_kg: "",
    production_rate: "",
  });
  const [savingProduction, setSavingProduction] = useState(false);
  const [productionMessage, setProductionMessage] = useState("");
  const [productionMessageError, setProductionMessageError] =
    useState(false);

  const [resourceForm, setResourceForm] = useState({
    power_kwh: "",
    water_litres: "",
    efficiency: "",
  });
  const [savingResources, setSavingResources] = useState(false);
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceMessageError, setResourceMessageError] = useState(false);

  const [alertForm, setAlertForm] = useState({
    title: "",
    detail: "",
    severity: "warning" as Severity,
  });
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertMessageError, setAlertMessageError] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadMachines = useCallback(async () => {
    setMachinesLoading(true);
    setMachinesError("");

    try {
      const response = await fetch(`${API}/electrolyzers`);
      if (!response.ok) {
        throw new Error(`Electrolyzers API returned ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error("Unexpected electrolyzers API response.");
      }

      setMachines(
        result.data.map(
          (
            item: {
              equipment_code: string;
              name: string;
              technology: string | null;
              status: string;
              temperature: number | string;
              pressure: number | string;
              load_percent: number | string;
            },
            index: number,
          ) => {
            const status = (
              ["Running", "Warning", "Standby"].includes(item.status)
                ? item.status
                : "Standby"
            ) as Machine["status"];

            return {
              id: item.equipment_code,
              name: item.name,
              type: item.technology || "Unspecified",
              status,
              temp: `${num(item.temperature, 0).toFixed(1)}°C`,
              pressure: `${num(item.pressure, 0).toFixed(1)} bar`,
              load: num(item.load_percent, 0),
              color: machineColor(status, index),
            };
          },
        ),
      );
    } catch (error) {
      setMachinesError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the electrolyzers API.",
      );
    } finally {
      setMachinesLoading(false);
    }
  }, []);

  const loadHydroPulseData = useCallback(async () => {
    setApiLoading(true);
    setApiError("");

    try {
      const responses = await Promise.all([
        fetch(`${API}/production`),
        fetch(`${API}/resources`),
        fetch(`${API}/alerts`),
      ]);

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        throw new Error(`An API returned HTTP ${failed.status}.`);
      }

      const [productionResult, resourcesResult, alertsResult] =
        await Promise.all(responses.map((response) => response.json()));

      if (
        !productionResult.success ||
        !resourcesResult.success ||
        !alertsResult.success
      ) {
        throw new Error(
          "An API returned an unsuccessful response. Check your backend routes.",
        );
      }

      const latestProduction = Array.isArray(productionResult.data)
        ? productionResult.data[0] ?? null
        : productionResult.data ?? null;

      const latestResource = Array.isArray(resourcesResult.data)
        ? resourcesResult.data[0] ?? null
        : resourcesResult.data ?? null;

      setProductionData(latestProduction);
      setResourceData(latestResource);
      setApiAlerts(
        Array.isArray(alertsResult.data) ? alertsResult.data : [],
      );
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to load production, resources and alerts.",
      );
    } finally {
      setApiLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    void loadMachines();
    void loadHydroPulseData();
  }, [loadMachines, loadHydroPulseData]);

  const visibleAlerts: DisplayAlert[] =
    apiAlerts.length > 0
      ? apiAlerts
          .filter((alert) => !alert.is_resolved)
          .map((alert) => ({
            id: alert.id,
            title: alert.title,
            detail: alert.detail || "No additional details",
            time: new Date(alert.created_at).toLocaleString(),
            type: alert.severity,
          }))
      : demoAlertsVisible
        ? demoAlerts
        : [];

  const filteredMachines = machines.filter(
    (machine) =>
      `${machine.name} ${machine.id} ${machine.status}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (statusFilter === "All" || machine.status === statusFilter),
  );

  function refreshDashboard() {
    void loadMachines();
    void loadHydroPulseData();
  }

  async function saveProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduction(true);
    setProductionMessage("");
    setProductionMessageError(false);

    const payload = {
      hydrogen_kg: Number(productionForm.hydrogen_kg),
      target_kg: Number(productionForm.target_kg),
      production_rate: Number(productionForm.production_rate),
    };

    if (
      Object.values(payload).some(
        (value) => !Number.isFinite(value) || value < 0,
      ) ||
      Object.values(productionForm).some((value) => value.trim() === "")
    ) {
      setProductionMessage("Enter valid non-negative numbers in all fields.");
      setProductionMessageError(true);
      setSavingProduction(false);
      return;
    }

    try {
      const response = await fetch(`${API}/production`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save production data.");
      }

      setProductionMessage("Production record saved successfully.");
      setProductionForm({
        hydrogen_kg: "",
        target_kg: "",
        production_rate: "",
      });
      await loadHydroPulseData();
    } catch (error) {
      setProductionMessage(
        error instanceof Error ? error.message : "Unable to save production.",
      );
      setProductionMessageError(true);
    } finally {
      setSavingProduction(false);
    }
  }

  async function saveResources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingResources(true);
    setResourceMessage("");
    setResourceMessageError(false);

    const payload = {
      power_kwh: Number(resourceForm.power_kwh),
      water_litres: Number(resourceForm.water_litres),
      efficiency: Number(resourceForm.efficiency),
    };

    if (
      Object.values(payload).some(
        (value) => !Number.isFinite(value) || value < 0,
      ) ||
      payload.efficiency > 100 ||
      Object.values(resourceForm).some((value) => value.trim() === "")
    ) {
      setResourceMessage(
        "Enter valid values. Efficiency must be between 0 and 100.",
      );
      setResourceMessageError(true);
      setSavingResources(false);
      return;
    }

    try {
      const response = await fetch(`${API}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save resource readings.");
      }

      setResourceMessage("Resource readings saved successfully.");
      setResourceForm({ power_kwh: "", water_litres: "", efficiency: "" });
      await loadHydroPulseData();
    } catch (error) {
      setResourceMessage(
        error instanceof Error ? error.message : "Unable to save resources.",
      );
      setResourceMessageError(true);
    } finally {
      setSavingResources(false);
    }
  }

  async function createAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAlert(true);
    setAlertMessage("");
    setAlertMessageError(false);

    try {
      const response = await fetch(`${API}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertForm),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to create alert.");
      }

      setDemoAlertsVisible(false);
      setAlertMessage("Alert created successfully.");
      setAlertForm({ title: "", detail: "", severity: "warning" });
      await loadHydroPulseData();
    } catch (error) {
      setAlertMessage(
        error instanceof Error ? error.message : "Unable to create alert.",
      );
      setAlertMessageError(true);
    } finally {
      setSavingAlert(false);
    }
  }

  async function resolveAlert(id: number) {
    setResolvingId(id);
    setAlertMessage("");
    setAlertMessageError(false);

    try {
      const response = await fetch(`${API}/alerts/${id}/resolve`, {
        method: "PATCH",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to resolve alert.");
      }

      setDemoAlertsVisible(false);
      setAlertMessage("Alert resolved successfully.");
      await loadHydroPulseData();
    } catch (error) {
      setAlertMessage(
        error instanceof Error ? error.message : "Unable to resolve alert.",
      );
      setAlertMessageError(true);
    } finally {
      setResolvingId(null);
    }
  }

  function exportReport() {
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Hydrogen production", `${fmt(num(productionData?.hydrogen_kg, 248.6))} kg`],
      ["Production target", `${fmt(num(productionData?.target_kg, 280))} kg`],
      ["Production rate", `${fmt(num(productionData?.production_rate, 42.8))} kg/h`],
      ["Power consumption", `${fmt(num(resourceData?.power_kwh, 1240), 0)} kWh`],
      ["Water consumption", `${fmt(num(resourceData?.water_litres, 1120), 0)} litres`],
      ["Plant efficiency", `${fmt(num(resourceData?.efficiency, 92.4))}%`],
      ...machines.map((machine) => [
        machine.name,
        `${machine.status}, ${machine.load}% load`,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "hydropulse-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const hydrogen = num(productionData?.hydrogen_kg, 248.6);
  const target = num(productionData?.target_kg, 280);
  const power = num(resourceData?.power_kwh, 1240);
  const water = num(resourceData?.water_litres, 1120);
  const efficiency = num(resourceData?.efficiency, 92.4);
  const rate = num(productionData?.production_rate, 42.8);

  function renderOverview() {
    return (
      <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> LIVE MONITORING / PLANT 01
            </div>
            <h1>Plant Overview <span className="wave">✳</span></h1>
            <p className="subtitle">
              Your hydrogen production at a glance. Here's what's happening today.
            </p>
          </div>
          <div className="welcome-actions">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="period-select"
              aria-label="Reporting period"
            >
              <option>Today</option>
              <option>This week</option>
              <option>This month</option>
            </select>
            <button className="secondary-btn" onClick={refreshDashboard}>
              <Activity size={16} /> Refresh
            </button>
            <button className="primary-btn" onClick={exportReport}>
              <Download size={16} /> Export report
            </button>
          </div>
        </section>

        <section className="kpi-grid">
          <div className="kpi-card accent-mint">
            <div className="kpi-top">
              <span className="kpi-icon mint-icon"><FlaskConical size={20} /></span>
              <span className="trend positive"><ArrowUpRight size={15} /> Live</span>
            </div>
            <p className="kpi-label">Hydrogen produced</p>
            <div className="kpi-number">{fmt(hydrogen)} <span>kg</span></div>
            <p className="kpi-foot">Daily target: {fmt(target, 0)} kg</p>
            <div className="progress-track">
              <div className="progress-fill mint-fill" style={{ width: `${Math.min(100, hydrogen / Math.max(1, target) * 100)}%` }} />
            </div>
          </div>

          <div className="kpi-card accent-blue">
            <div className="kpi-top">
              <span className="kpi-icon blue-icon"><Zap size={20} /></span>
              <span className="trend positive">Energy</span>
            </div>
            <p className="kpi-label">Power consumption</p>
            <div className="kpi-number">{fmt(power, 0)} <span>kWh</span></div>
            <p className="kpi-foot">Energy usage recorded</p>
            <div className="mini-bars">
              {[36, 55, 42, 68, 50, 82, 61, 74, 49, 90, 65, 77].map((value, index) => (
                <span key={index} style={{ height: `${value}%` }} />
              ))}
            </div>
          </div>

          <div className="kpi-card accent-cyan">
            <div className="kpi-top">
              <span className="kpi-icon cyan-icon"><Droplets size={20} /></span>
              <span className="trend neutral">Resources</span>
            </div>
            <p className="kpi-label">Water consumed</p>
            <div className="kpi-number">{fmt(water, 0)} <span>litres</span></div>
            <p className="kpi-foot">Resource utilization</p>
            <div className="progress-track">
              <div className="progress-fill cyan-fill" style={{ width: "64%" }} />
            </div>
          </div>

          <div className="kpi-card accent-violet">
            <div className="kpi-top">
              <span className="kpi-icon violet-icon"><CircleGauge size={20} /></span>
              <span className="trend positive">Efficiency</span>
            </div>
            <p className="kpi-label">Plant efficiency</p>
            <div className="kpi-number">{fmt(efficiency)}<span>%</span></div>
            <p className="kpi-foot">Operational performance</p>
            <div className="progress-track">
              <div className="progress-fill violet-fill" style={{ width: `${Math.min(100, efficiency)}%` }} />
            </div>
          </div>
        </section>

        <section className="charts-grid">
          <div className="panel production-panel">
            <div className="panel-heading">
              <div>
                <h2>Hydrogen production</h2>
                <p>Illustrative production rate throughout the day</p>
              </div>
            </div>
            <div className="chart-summary">
              <strong>{fmt(rate)} <span>kg/h</span></strong>
              <span className="summary-positive">Latest recorded rate</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionChart}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area dataKey="target" stroke="#8bb4ff" strokeDasharray="5 5" fill="none" name="Target" />
                  <Area dataKey="hydrogen" stroke="#26bc91" strokeWidth={3} fill="#26bc9120" name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel resource-panel">
            <div className="panel-heading">
              <div>
                <h2>Resource consumption</h2>
                <p>Weekly sample usage comparison</p>
              </div>
              <span className="soft-icon"><Waves size={18} /></span>
            </div>
            <div className="resource-legend">
              <span><i className="legend-square power-square" /> Power index</span>
              <span><i className="legend-square water-square" /> Water index</span>
            </div>
            <div className="chart-container resource-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resourceChart}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="power" fill="#6588f7" radius={[5, 5, 0, 0]} name="Power index" />
                  <Bar dataKey="water" fill="#41c9d8" radius={[5, 5, 0, 0]} name="Water index" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="resource-note">
              <CheckCircle2 size={16} /> Latest power: {fmt(power, 0)} kWh · water: {fmt(water, 0)} litres
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel electrolyzer-panel">
            <div className="panel-heading">
              <div>
                <h2>Electrolyzer fleet</h2>
                <p>Equipment performance</p>
              </div>
              <button className="text-btn" onClick={() => setPage("Electrolyzers")}>
                View all <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="machine-list">
              {machines.slice(0, 4).map((machine) => (
                <div className="machine-row" key={machine.id}>
                  <div className={`machine-icon ${machine.color}`}><Atom size={20} /></div>
                  <div className="machine-info">
                    <strong>{machine.name}</strong>
                    <span>{machine.id} · {machine.type}</span>
                  </div>
                  <div className="machine-load">
                    <div className="load-line"><span className={machine.color} style={{ width: `${machine.load}%` }} /></div>
                    <span>{machine.load}% load</span>
                  </div>
                  <span className={`status-pill ${machine.status.toLowerCase()}`}><i />{machine.status}</span>
                </div>
              ))}
              {machines.length === 0 && !machinesLoading && (
                <p className="empty-state">No equipment data found.</p>
              )}
            </div>
          </div>

          <div className="panel alerts-panel">
            <div className="panel-heading">
              <div>
                <h2>Recent activity</h2>
                <p>Latest plant notifications</p>
              </div>
              <button className="icon-btn small" onClick={() => setPage("Alerts")} aria-label="View alerts">
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="activity-list">
              {visibleAlerts.slice(0, 3).map((alert) => (
                <div className="activity-row" key={alert.id}>
                  <div className={`activity-icon ${alert.type}`}>
                    {alert.type === "warning" || alert.type === "critical"
                      ? <AlertTriangle size={17} />
                      : alert.type === "success"
                        ? <CheckCircle2 size={17} />
                        : <CalendarDays size={17} />}
                  </div>
                  <div className="activity-content">
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                    <span><Clock3 size={12} />{alert.time}</span>
                  </div>
                </div>
              ))}
              {visibleAlerts.length === 0 && <p className="empty-state">No recent alerts.</p>}
            </div>
            <button className="clear-alerts" onClick={() => setPage("Alerts")}>
              View all alerts
            </button>
          </div>
        </section>

        <div className="refresh-note">
          <Clock3 size={13} /> Last refreshed at {lastRefresh.toLocaleTimeString()}
        </div>
      </>
    );
  }

  function renderElectrolyzers() {
    return (
      <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow">EQUIPMENT MANAGEMENT</div>
            <h1>Electrolyzers</h1>
            <p className="subtitle">Monitor and inspect all production units.</p>
          </div>
          <button className="primary-btn" onClick={exportReport}><Download size={16} /> Export report</button>
        </section>

        <section className="kpi-grid three-kpis">
          <div className="kpi-card"><p className="kpi-label">Total units</p><div className="kpi-number">{machines.length} <span>units</span></div></div>
          <div className="kpi-card"><p className="kpi-label">Currently running</p><div className="kpi-number">{machines.filter((machine) => machine.status === "Running").length} <span>units</span></div></div>
          <div className="kpi-card"><p className="kpi-label">Needs attention</p><div className="kpi-number">{machines.filter((machine) => machine.status === "Warning").length} <span>units</span></div></div>
        </section>

        <div className="panel full-table-panel">
          <div className="panel-heading">
            <div><h2>Equipment inventory</h2><p>Search equipment or filter by status</p></div>
            <div className="equipment-controls">
              <select className="period-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MachineStatus)}>
                <option value="All">All statuses</option>
                <option value="Running">Running</option>
                <option value="Warning">Warning</option>
                <option value="Standby">Standby</option>
              </select>
              <div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search equipment..." /></div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Equipment</th><th>Technology</th><th>Temperature</th><th>Pressure</th><th>Load</th><th>Status</th></tr></thead>
              <tbody>
                {filteredMachines.map((machine) => (
                  <tr key={machine.id}>
                    <td><strong>{machine.name}</strong><small>{machine.id}</small></td>
                    <td>{machine.type}</td>
                    <td><Thermometer size={15} /> {machine.temp}</td>
                    <td><Gauge size={15} /> {machine.pressure}</td>
                    <td><div className="table-load">{machine.load}%<div className="load-line"><span className={machine.color} style={{ width: `${machine.load}%` }} /></div></div></td>
                    <td><span className={`status-pill ${machine.status.toLowerCase()}`}><i />{machine.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMachines.length === 0 && <p className="empty-state">No equipment matches your search and filter.</p>}
          </div>
          <div className="table-footer">Showing {filteredMachines.length} of {machines.length} units</div>
        </div>
      </>
    );
  }

  function renderProduction() {
    return (
      <>
        <section className="welcome-row">
          <div><div className="eyebrow">OUTPUT ANALYTICS</div><h1>Production Analytics</h1><p className="subtitle">Track hydrogen generation and save new production records.</p></div>
          <button className="primary-btn" onClick={exportReport}><Download size={16} /> Export report</button>
        </section>

        <section className="kpi-grid three-kpis">
          <div className="kpi-card accent-mint"><p className="kpi-label">Latest hydrogen output</p><div className="kpi-number">{fmt(hydrogen)} <span>kg</span></div></div>
          <div className="kpi-card accent-blue"><p className="kpi-label">Production target</p><div className="kpi-number">{fmt(target, 0)} <span>kg</span></div></div>
          <div className="kpi-card accent-violet"><p className="kpi-label">Target achieved</p><div className="kpi-number">{fmt((hydrogen / Math.max(target, 1)) * 100)}<span>%</span></div></div>
        </section>

        <div className="panel standalone-chart">
          <div className="panel-heading"><div><h2>Production vs target</h2><p>Illustrative hourly hydrogen output (kg/h)</p></div></div>
          <div className="chart-container tall-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionChart}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area dataKey="target" stroke="#8bb4ff" strokeDasharray="5 5" fill="none" name="Target" />
                <Area dataKey="hydrogen" stroke="#26bc91" strokeWidth={3} fill="#26bc9120" name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel full-table-panel production-entry-panel">
          <div className="panel-heading"><div><h2>Add production record</h2><p>Save a new hydrogen production reading to PostgreSQL.</p></div></div>
          <form className="production-entry-form" onSubmit={saveProduction}>
            <label>Hydrogen produced (kg)<input type="number" min="0" step="0.01" required value={productionForm.hydrogen_kg} onChange={(event) => setProductionForm({ ...productionForm, hydrogen_kg: event.target.value })} placeholder="e.g. 248.6" /></label>
            <label>Production target (kg)<input type="number" min="0" step="0.01" required value={productionForm.target_kg} onChange={(event) => setProductionForm({ ...productionForm, target_kg: event.target.value })} placeholder="e.g. 280" /></label>
            <label>Production rate (kg/h)<input type="number" min="0" step="0.01" required value={productionForm.production_rate} onChange={(event) => setProductionForm({ ...productionForm, production_rate: event.target.value })} placeholder="e.g. 42.8" /></label>
            <button className="primary-btn" type="submit" disabled={savingProduction}>{savingProduction ? "Saving..." : "Save production record"}</button>
          </form>
          {productionMessage && <p className="production-message" role="status" style={{ color: productionMessageError ? "#dc2626" : "#059669", marginTop: 16 }}>{productionMessage}</p>}
        </div>
        <div className="demo-note"><AlertTriangle size={15} /> The hourly chart is illustrative. Summary values use the latest API record.</div>
      </>
    );
  }

  function renderResources() {
    return (
      <>
        <section className="welcome-row">
          <div><div className="eyebrow">SUSTAINABILITY MONITORING</div><h1>Resource Management</h1><p className="subtitle">Track energy usage and water consumption.</p></div>
          <button className="primary-btn" onClick={exportReport}><Download size={16} /> Export report</button>
        </section>

        <section className="kpi-grid">
          <div className="kpi-card accent-blue"><div className="kpi-icon blue-icon"><Zap /></div><p className="kpi-label">Power consumption</p><div className="kpi-number">{fmt(power, 0)} <span>kWh</span></div></div>
          <div className="kpi-card accent-cyan"><div className="kpi-icon cyan-icon"><Droplets /></div><p className="kpi-label">Water consumption</p><div className="kpi-number">{fmt(water, 0)} <span>litres</span></div></div>
          <div className="kpi-card accent-violet"><div className="kpi-icon violet-icon"><Wind /></div><p className="kpi-label">Plant efficiency</p><div className="kpi-number">{fmt(efficiency)}<span>%</span></div></div>
          <div className="kpi-card accent-mint"><div className="kpi-icon mint-icon"><Activity /></div><p className="kpi-label">Equipment uptime</p><div className="kpi-number">98.2<span>%</span></div><p className="kpi-foot">Illustrative availability</p></div>
        </section>

        <div className="panel standalone-chart">
          <div className="panel-heading"><div><h2>Weekly resource consumption</h2><p>Relative sample consumption index</p></div></div>
          <div className="chart-container tall-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceChart}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="power" fill="#6588f7" radius={[5, 5, 0, 0]} name="Power index" />
                <Bar dataKey="water" fill="#41c9d8" radius={[5, 5, 0, 0]} name="Water index" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel full-table-panel">
          <div className="panel-heading"><div><h2>Add resource readings</h2><p>Save power, water and efficiency readings to PostgreSQL.</p></div></div>
          <form className="production-entry-form record-form" onSubmit={saveResources}>
            <label>Power consumption (kWh)<input type="number" min="0" step="0.01" required value={resourceForm.power_kwh} onChange={(event) => setResourceForm({ ...resourceForm, power_kwh: event.target.value })} placeholder="e.g. 1240" /></label>
            <label>Water consumption (litres)<input type="number" min="0" step="0.01" required value={resourceForm.water_litres} onChange={(event) => setResourceForm({ ...resourceForm, water_litres: event.target.value })} placeholder="e.g. 1120" /></label>
            <label>Plant efficiency (%)<input type="number" min="0" max="100" step="0.1" required value={resourceForm.efficiency} onChange={(event) => setResourceForm({ ...resourceForm, efficiency: event.target.value })} placeholder="e.g. 92.4" /></label>
            <button className="primary-btn" type="submit" disabled={savingResources}>{savingResources ? "Saving..." : "Save resource readings"}</button>
          </form>
          {resourceMessage && <p role="status" style={{ color: resourceMessageError ? "#dc2626" : "#059669", marginTop: 16 }}>{resourceMessage}</p>}
        </div>
        <div className="demo-note"><AlertTriangle size={15} /> Summary metrics use the API. Weekly chart history is sample data.</div>
      </>
    );
  }

  function renderAlerts() {
    return (
      <>
        <section className="welcome-row">
          <div><div className="eyebrow">PLANT NOTIFICATIONS</div><h1>Alerts &amp; Activity</h1><p className="subtitle">Create alerts, review operational events and resolve warnings.</p></div>
          <button className="secondary-btn" onClick={refreshDashboard}><Activity size={16} /> Refresh alerts</button>
        </section>

        <div className="panel full-table-panel">
          <div className="panel-heading"><div><h2>Create new alert</h2><p>Record a plant warning or operational event.</p></div></div>
          <form className="production-entry-form record-form" onSubmit={createAlert}>
            <label>Alert title<input required maxLength={200} value={alertForm.title} onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })} placeholder="e.g. High electrolyzer temperature" /></label>
            <label>Severity<select value={alertForm.severity} onChange={(event) => setAlertForm({ ...alertForm, severity: event.target.value as Severity })}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
            <label className="record-form-wide">Details<textarea rows={3} value={alertForm.detail} onChange={(event) => setAlertForm({ ...alertForm, detail: event.target.value })} placeholder="Describe the issue or event" /></label>
            <button className="primary-btn" type="submit" disabled={savingAlert}>{savingAlert ? "Creating..." : "Create alert"}</button>
          </form>
          {alertMessage && <p role="status" style={{ color: alertMessageError ? "#dc2626" : "#059669", marginTop: 16 }}>{alertMessage}</p>}
        </div>

        <div className="panel full-table-panel">
          <div className="panel-heading">
            <div><h2>Unresolved notifications</h2><p>{visibleAlerts.length} notifications available</p></div>
            <button className="secondary-btn" onClick={refreshDashboard}><Activity size={15} /> Refresh</button>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="empty-large">
              <CheckCircle2 size={34} />
              <h3>You're all caught up</h3>
              <p>No unresolved database alerts are currently available.</p>
            </div>
          ) : (
            <div className="activity-list alerts-page-list">
              {visibleAlerts.map((alert) => (
                <div className="activity-row" key={alert.id}>
                  <div className={`activity-icon ${alert.type}`}>
                    {alert.type === "warning" || alert.type === "critical"
                      ? <AlertTriangle />
                      : alert.type === "success"
                        ? <CheckCircle2 />
                        : <CalendarDays />}
                  </div>
                  <div className="activity-content">
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                    <span><Clock3 size={12} /> {alert.time}</span>
                  </div>
                  <span className={`status-pill ${alert.type === "critical" ? "warning" : alert.type === "warning" ? "warning" : alert.type === "success" ? "running" : "standby"}`}>
                    {alert.type}
                  </span>
                  {alert.isDemo ? (
                    <span className="status-pill standby">Demo</span>
                  ) : (
                    <button className="secondary-btn resolve-btn" disabled={resolvingId === alert.id} onClick={() => void resolveAlert(alert.id)}>
                      {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="demo-note"><AlertTriangle size={15} /> Resolving a database alert saves the change to PostgreSQL. Demo alerts cannot be resolved in the database.</div>
      </>
    );
  }

  function renderSimplePage() {
    const reports = page === "Reports";

    return (
      <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow">HYDROPULSE MANAGEMENT</div>
            <h1>{page}</h1>
            <p className="subtitle">{reports ? "Export production, equipment and resource data for review." : "Customize your monitoring workspace."}</p>
          </div>
        </section>
        <div className="panel simple-page">
          <div className="simple-icon">{reports ? <Download size={30} /> : <Settings size={30} />}</div>
          <h2>{reports ? "Your plant report is ready" : "Workspace preferences"}</h2>
          <p>{reports ? "Download a CSV report containing current API metrics and equipment status." : "This workspace currently uses default plant settings."}</p>
          {reports ? (
            <button className="primary-btn" onClick={exportReport}><Download size={16} /> Download CSV report</button>
          ) : (
            <button className="primary-btn" onClick={() => setPage("Overview")}>Return to overview <ArrowUpRight size={16} /></button>
          )}
        </div>
        {!reports && <div className="demo-note"><AlertTriangle size={15} /> Settings are not saved to a server yet.</div>}
      </>
    );
  }

  return (
    <div className="app-shell">
      {menuOpen && <button aria-label="Close navigation" className="mobile-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Atom size={25} /></div>
          <div className="brand-text"><strong>Hydro<span>Pulse</span></strong><small>PLANT INTELLIGENCE</small></div>
          <button className="mobile-close icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button>
        </div>

        <div className="plant-switcher">
          <div className="plant-avatar"><Wind size={20} /></div>
          <div><strong>Green Hydrogen Co.</strong><small>Plant facility 01</small></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={`nav-item ${page === item.label ? "active" : ""}`} onClick={() => { setPage(item.label); setMenuOpen(false); }}>
                <Icon size={19} /><span>{item.label}</span>
                {item.label === "Alerts" && visibleAlerts.length > 0 && <span className="nav-count">{visibleAlerts.length}</span>}
                {page === item.label && <span className="active-bar" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon"><CircleHelp size={19} /></div>
            <strong>Need a hand?</strong>
            <p>Check your plant monitoring guide.</p>
            <button onClick={() => setPage("Reports")}>Explore resources <ArrowUpRight size={14} /></button>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">HP</div>
            <div className="profile-info"><strong>Plant Administrator</strong><small>Operations team</small></div>
            <Settings size={17} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
            <span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span><strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <div className="system-status"><span className="live-dot" /> API monitoring</div>
            <div className="topbar-divider" />
            <button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={19} />{visibleAlerts.length > 0 && <i />}
            </button>
            {showNotifications && (
              <div className="notification-popover">
                <strong>Notifications</strong>
                <p>{visibleAlerts.length ? `${visibleAlerts.length} unresolved activity items` : "No new notifications"}</p>
                <button onClick={() => { setPage("Alerts"); setShowNotifications(false); }}>View activity</button>
              </div>
            )}
            <div className="topbar-divider" />
            <div className="topbar-date"><CalendarDays size={16} />{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            <div className="user-avatar">HP</div>
          </div>
        </header>

        <div className="page-content">
          {machinesLoading && <div className="demo-note"><Clock3 size={15} /> Loading electrolyzer data from the backend...</div>}
          {machinesError && <div className="demo-note"><AlertTriangle size={15} /> Could not load electrolyzer data: {machinesError}</div>}
          {apiLoading && <div className="demo-note"><Clock3 size={15} /> Loading production, resources and alerts...</div>}
          {apiError && <div className="demo-note"><AlertTriangle size={15} /> Could not load production, resources or alerts: {apiError}</div>}

          {page === "Overview"
            ? renderOverview()
            : page === "Electrolyzers"
              ? renderElectrolyzers()
              : page === "Production"
                ? renderProduction()
                : page === "Resources"
                  ? renderResources()
                  : page === "Alerts"
                    ? renderAlerts()
                    : renderSimplePage()}
        </div>

        <footer className="app-footer">
          <span>© 2026 HydroPulse Intelligence</span>
          <span><span className="footer-live" /> Demo environment · API connected where available</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
