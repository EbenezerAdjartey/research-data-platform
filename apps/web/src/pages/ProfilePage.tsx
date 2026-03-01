import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { auth } from '@rdp/api-client';
import { useAuth } from '@/context/useAuth';
import toast from 'react-hot-toast';
import { User, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setInstitution(user.institution ?? '');
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => auth.updateProfile({ full_name: fullName, institution: institution || undefined }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1 text-sm">Update your personal information</p>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.full_name || '—'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="University or organisation"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
