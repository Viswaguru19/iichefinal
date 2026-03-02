'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, MapPin, FileText, Image as ImageIcon, CheckCircle, Clock } from 'lucide-react';

export default function EventDetailPage() {
  const [event, setEvent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    loadEventDetails();
  }, []);

  async function loadEventDetails() {
    const { data: eventData } = await supabase
      .from('event_proposals')
      .select('*, committees(name), proposer:profiles!event_proposals_proposed_by_user_fkey(name)')
      .eq('id', params.id)
      .single();

    setEvent(eventData);

    const { data: tasksData } = await supabase
      .from('event_tasks')
      .select('*, committees(name), updates:task_updates(*, updater:profiles(name))')
      .eq('proposal_id', params.id);

    setTasks(tasksData || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>;
  }

  if (!event) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Event not found</div>
    </div>;
  }

  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payments`;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Event Details</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Event Poster */}
        {event.poster_url && (
          <div className="mb-6">
            <img 
              src={`${storageUrl}/${event.poster_url}`} 
              alt={event.title}
              className="w-full max-w-2xl mx-auto rounded-xl shadow-lg"
            />
          </div>
        )}

        {/* Event Info */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{event.title}</h2>
              <p className="text-lg text-gray-600 mt-2">{event.committees?.name}</p>
              <p className="text-sm text-gray-500">Proposed by: {event.proposer?.name}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${
              event.status === 'approved' ? 'bg-green-100 text-green-800' :
              event.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              event.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {event.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <p className="text-gray-700 mb-6">{event.description}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-5 h-5" />
              <span>{new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {event.supporting_doc_url && (
            <a 
              href={`${storageUrl}/${event.supporting_doc_url}`}
              target="_blank"
              className="inline-flex items-center gap-2 text-blue-600 hover:underline"
            >
              <FileText className="w-4 h-4" />
              View Supporting Document
            </a>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Assigned Tasks</h3>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900">{task.task_title}</h4>
                      <p className="text-sm text-gray-600">{task.committees?.name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {task.task_description && (
                    <p className="text-gray-700 text-sm mb-3">{task.task_description}</p>
                  )}

                  {task.updates && task.updates.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-bold text-gray-700">Updates:</p>
                      {task.updates.map((update: any) => (
                        <div key={update.id} className="bg-gray-50 p-2 rounded text-sm">
                          <p className="text-gray-700">{update.update_text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {update.updater?.name} - {new Date(update.created_at).toLocaleDateString()}
                          </p>
                          {update.document_url && (
                            <a href={`${storageUrl}/${update.document_url}`} target="_blank" className="text-xs text-blue-600 hover:underline">
                              View Document
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No tasks assigned yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
