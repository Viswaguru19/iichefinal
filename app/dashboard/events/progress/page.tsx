'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventProgressPage() {
  const [approvedEvents, setApprovedEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();
    setCurrentUser(profile);

    const { data: events } = await supabase
      .from('event_proposals')
      .select('*, committee:committees(name)')
      .eq('status', 'approved')
      .order('event_date', { ascending: false });
    setApprovedEvents(events || []);

    const { data: comms } = await supabase
      .from('committees')
      .select('id, name')
      .order('name');
    setCommittees(comms || []);
  }

  async function loadTasks(eventId: string) {
    const { data } = await supabase
      .from('event_committee_tasks')
      .select('*, committee:committees(name), updates:event_daily_updates(*, user:profiles(name))')
      .eq('proposal_id', eventId)
      .order('created_at');
    setTasks(data || []);
  }

  async function selectEvent(event: any) {
    setSelectedEvent(event);
    await loadTasks(event.id);
  }

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from('event_committee_tasks')
      .insert({
        proposal_id: selectedEvent.id,
        committee_id: formData.get('committee_id'),
        task_title: formData.get('task_title'),
        task_description: formData.get('task_description'),
        assigned_by: currentUser.id
      });

    if (error) {
      toast.error('Failed to create task');
    } else {
      toast.success('Task assigned');
      setShowTaskModal(false);
      loadTasks(selectedEvent.id);
    }
  }

  async function postUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from('event_daily_updates')
      .insert({
        task_id: selectedTask.id,
        committee_id: selectedTask.committee_id,
        update_text: formData.get('update_text'),
        updated_by: currentUser.id
      });

    if (error) {
      toast.error('Failed to post update');
    } else {
      toast.success('Update posted');
      setShowUpdateModal(false);
      loadTasks(selectedEvent.id);
    }
  }

  async function markComplete(taskId: string) {
    const { error } = await supabase
      .from('event_committee_tasks')
      .update({ status: 'completed' })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Task marked complete');
      loadTasks(selectedEvent.id);
    }
  }

  const isExecutive = currentUser?.executive_role !== null;
  const progress = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Event Progress Tracking</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">Approved Events</h2>
            <div className="space-y-2">
              {approvedEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  className={`w-full text-left p-3 rounded ${
                    selectedEvent?.id === event.id
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <p className="font-medium text-gray-900 dark:text-white">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.committee?.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            {selectedEvent ? (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedEvent.title}</h2>
                    {isExecutive && (
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-5 h-5" />
                        Assign Task
                      </button>
                    )}
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Progress: {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{task.task_title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{task.committee?.name}</p>
                          <p className="text-sm text-gray-500 mt-1">{task.task_description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs ${
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status}
                          </span>
                          {task.status !== 'completed' && isExecutive && (
                            <button
                              onClick={() => markComplete(task.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Updates</h4>
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowUpdateModal(true);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Update
                          </button>
                        </div>
                        <div className="space-y-2">
                          {task.updates?.map((update: any) => (
                            <div key={update.id} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                              <p className="text-sm text-gray-900 dark:text-white">{update.update_text}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {update.user?.name} • {new Date(update.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Select an event to view tasks</div>
            )}
          </div>
        </div>
      </div>

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Assign Task</h2>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Committee</label>
                <select
                  name="committee_id"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title</label>
                <input
                  type="text"
                  name="task_title"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  name="task_description"
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Assign
                </button>
                <button type="button" onClick={() => setShowTaskModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Post Update</h2>
            <form onSubmit={postUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Update</label>
                <textarea
                  name="update_text"
                  required
                  rows={4}
                  placeholder="What progress have you made?"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Post
                </button>
                <button type="button" onClick={() => setShowUpdateModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg">
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
