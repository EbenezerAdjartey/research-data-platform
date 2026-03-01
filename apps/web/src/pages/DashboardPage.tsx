import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboard, projects } from '@rdp/api-client';
import { useAuth } from '@/context/useAuth';
import {
  FolderOpen, Database, BarChart3, Plus,
  Globe, Link2, FileText, ArrowRight, Clock,
  TrendingUp, Activity,
} from 'lucide-react';

const fmt = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboard.stats,
  });

  const { data: projectList, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const recentProjects = projectList?.slice(0, 4) ?? [];
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8 max-w-6xl">

      {/* ── Welcome header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {firstName}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {user?.institution
              ? `${user.institution} · Research Data Platform`
              : 'Research Data Platform'}
          </p>
        </div>
        <Link
          to="/projects"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<FolderOpen className="w-5 h-5" />}
          label="Projects"
          value={stats?.total_projects}
          loading={statsLoading}
          color="blue"
          href="/projects"
        />
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label="Datasets"
          value={stats?.total_datasets}
          loading={statsLoading}
          color="green"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Analyses Run"
          value={stats?.total_analyses}
          loading={statsLoading}
          color="purple"
        />
      </div>

      {/* ── Main content: recent projects + quick actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600" /> Recent Projects
            </h2>
            <Link to="/projects" className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
              All projects <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <GettingStartedChecklist />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-primary-200 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
                      <FolderOpen className="w-4 h-4 text-primary-600" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0 mt-1" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm truncate mb-1">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {timeAgo(p.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-600" /> Quick Actions
          </h2>
          <div className="space-y-2">
            <QuickAction
              icon={<Plus className="w-4 h-4" />}
              label="New Project"
              description="Start a new research workspace"
              href="/projects"
              color="primary"
            />
            <QuickAction
              icon={<Globe className="w-4 h-4" />}
              label="Browse Open Datasets"
              description="Import Iris, Titanic, Gapminder & more"
              href={recentProjects[0] ? `/projects/${recentProjects[0].id}` : '/projects'}
              color="green"
            />
            <QuickAction
              icon={<Link2 className="w-4 h-4" />}
              label="Import from URL"
              description="Paste any public CSV or JSON link"
              href={recentProjects[0] ? `/projects/${recentProjects[0].id}` : '/projects'}
              color="orange"
            />
            <QuickAction
              icon={<FileText className="w-4 h-4" />}
              label="Build a Report"
              description="Compose and export PDF or DOCX"
              href={recentProjects[0] ? `/projects/${recentProjects[0].id}/reports` : '/projects'}
              color="red"
            />
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      {(stats?.recent_analyses?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary-600" /> Recent Activity
          </h2>
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="divide-y">
              {stats!.recent_analyses.map((a) => (
                <Link
                  key={a.id}
                  to={`/projects/${a.project_id}/analysis/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    a.status === 'completed' ? 'bg-green-500'
                    : a.status === 'failed' ? 'bg-red-500'
                    : 'bg-yellow-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{fmt(a.analysis_type)}</p>
                    <p className="text-xs text-gray-400 truncate">{a.project_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.status === 'completed' ? 'bg-green-100 text-green-700'
                      : a.status === 'failed' ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({
  icon, label, value, loading, color, href,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading: boolean;
  color: 'blue' | 'green' | 'purple';
  href?: string;
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  const inner = (
    <div className="bg-white border rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {loading ? (
          <div className="h-6 w-10 bg-gray-200 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
        )}
      </div>
    </div>
  );

  return href ? <Link to={href}>{inner}</Link> : <div>{inner}</div>;
}

function GettingStartedChecklist() {
  const steps = [
    { n: 1, label: 'Create a project', desc: 'Organise your research in a workspace', href: '/projects', cta: 'Create project' },
    { n: 2, label: 'Import a dataset', desc: 'Upload a CSV file or import from a URL', href: '/projects', cta: 'Go to projects' },
    { n: 3, label: 'Run an analysis', desc: 'Choose from 20+ statistical methods', href: '/projects', cta: 'Start analysing' },
    { n: 4, label: 'Ask AI', desc: 'Get plain-language answers from Claude', href: '/projects', cta: 'Try AI insights' },
  ];
  return (
    <div className="bg-white border rounded-xl p-6">
      <h3 className="font-semibold text-gray-800 mb-1">Getting Started</h3>
      <p className="text-sm text-gray-500 mb-5">Follow these steps to get the most out of RDP.</p>
      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 font-bold text-sm">
              {s.n}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{s.label}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </div>
            <Link
              to={s.href}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium shrink-0"
            >
              {s.cta} <ArrowRight className="w-3 h-3" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuickAction({
  icon, label, description, href, color,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  color: 'primary' | 'green' | 'orange' | 'red';
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    green:   'bg-green-50 text-green-600',
    orange:  'bg-orange-50 text-orange-600',
    red:     'bg-red-50 text-red-600',
  };

  return (
    <Link
      to={href}
      className="flex items-center gap-3 p-3 bg-white border rounded-xl hover:shadow-sm hover:border-gray-300 transition-all group"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition-colors">{label}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 shrink-0 ml-auto transition-colors" />
    </Link>
  );
}
