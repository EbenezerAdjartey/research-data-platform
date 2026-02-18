import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projects } from '@rdp/api-client';
import toast from 'react-hot-toast';
import { Plus, FolderOpen, Calendar } from 'lucide-react';

export default function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: projectList, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const createMutation = useMutation({
    mutationFn: () => projects.create({ name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setName('');
      setDescription('');
      toast.success('Project created');
    },
    onError: () => toast.error('Failed to create project'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your research projects</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="e.g., COVID-19 Survey Analysis"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading projects...</div>
      ) : !projectList?.length ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{project.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {new Date(project.updated_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
