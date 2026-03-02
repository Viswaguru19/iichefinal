'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [isExecutive, setIsExecutive] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [updateText, setUpdateText] = useState('');
  const [updateDoc, setUpdateDoc] = useState<File | null>(null);
  const [selectedProposal, setSelectedProposal] = useState('');
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: profile } = await supabase.from('profiles').select('executive_role').eq('id', user.id).single();
    setIsExecutive((profile as any)?.executive_role !== null);

    const { data: tasksData } = await supabase
      .from('event_tasks')
      .select('*, committees(name), proposals:event_proposals(title), updates:task_updates(*, updater:profiles(name))')
      .order('created_at', { ascending: false });
    setTasks(tasksData || []);

    const { data: proposalsData } = await supabase
      .from('event_proposals')
      .select('id, title')
      .eq('status', 'approved');
    setProposals(proposalsData || []);

    const { data: committeesData } = await supabase
      .from('committees')
      .select('id, name')
      .eq('type', 'regular');
    setCommittees(committeesData || []);
  }

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('event_tasks')
        .insert({
          proposal_id: selectedProposal,
          committee_id: selectedCommittee,
          task_title: taskTitle,
          task_description: taskDescription,
          assigned_by: user?.id,
          status: 'not_started'
        });

      if (error) throw error;

      // Send email notification to committee members
      await fetch('/api/notify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committeeId: selectedCommittee,
          taskTitle,
          taskDescription,
          proposalId: selectedProposal
        })
      });

      toast.success('Task assigned!');
      setShowAssign(false);
      setTaskTitle('');
      setTaskDescription('');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    try {
      const { error } = await (supabase as any)
        .from('event_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Status updated!');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !updateText) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let docUrl = null;
      if (updateDoc) {
        const fileName = `${Date.now()}_${updateDoc.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payments')
          .upload(`task-updates/${fileName}`, updateDoc);
        if (uploadError) throw uploadError;
        docUrl = uploadData.path;
      }

      const { error } = await (supabase as any)
        .from('task_updates')
        .insert({
          task_id: selectedTask.id,
          update_text: updateText,
          document_url: docUrl,
          updated_by: user?.id
        });

      if (error) throw error;

      toast.success('Update posted!');
      setSelectedTask(null);
      setUpdateText('');
      setUpdateDoc(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Tasks</h1>
            <div className="flex gap-4">
              {isExecutive && (
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Assign Task
                </button>
              )}
              <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {showAssign && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Assign New Task</h2>
            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event *</label>
                <select
                  value={selectedProposal}
                  onChange={(e) => setSelectedProposal(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select event</option>
                  {proposals.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Committee *</label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Task Title *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Assign Task'}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{task.task_title}</h3>
                  <p className="text-sm text-gray-600">{task.committees?.name}</p>
                  <p className="text-xs text-gray-500">Event: {task.proposals?.title}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                   task.status === 'in_progress' ? <Clock className="w-3 h-3" /> :
                   <AlertCircle className="w-3 h-3" />}
                  {task.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {task.task_description && (
                <p className="text-gray-700 mb-4">{task.task_description}</p>
              )}

              {task.updates && task.updates.length > 0 && (
                <div className="mb-4 space-y-2">
                  <h4 className="font-bold text-sm text-gray-700">Updates:</h4>
                  {task.updates.map((update: any) => (
                    <div key={update.id} className="bg-gray-50 p-3 rounded border">
                      <p className="text-sm text-gray-700">{update.update_text}</p>
                      <p className="text-xs text-gray-500 mt-1">By {update.updater?.name} - {new Date(update.created_at).toLocaleDateString()}</p>
                      {update.document_url && (
                        <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payments/${update.document_url}`} target="_blank" className="text-xs text-blue-600 hover:underline">View Document</a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {task.status !== 'in_progress' && (
                  <button
                    onClick={() => updateTaskStatus(task.id, 'in_progress')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Start Task
                  </button>
                )}
                {task.status !== 'completed' && (
                  <button
                    onClick={() => updateTaskStatus(task.id, 'completed')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                  >
                    Mark Complete
                  </button>
                )}
                <button
                  onClick={() => setSelectedTask(task)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
                >
                  Post Update
                </button>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <p className="text-gray-600">No tasks assigned yet</p>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Post Update - {selectedTask.task_title}</h2>
            <form onSubmit={handlePostUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Update *</label>
                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Describe the progress or update..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Attach Document (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setUpdateDoc(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Posting...' : 'Post Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
