import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">IIChE AVVU</Link>
            <div className="flex gap-4">
              <Link href="/committees" className="text-gray-700 hover:text-blue-600">Committees</Link>
              <Link href="/events" className="text-gray-700 hover:text-blue-600">Events</Link>
              <Link href="/kickoff" className="text-gray-700 hover:text-blue-600">Kickoff</Link>
              <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Login</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">About IIChE AVVU</h1>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Who We Are</h2>
          <p className="text-gray-600 mb-4">
            The Indian Institute of Chemical Engineers (IIChE) AVVU Chapter is a student-run organization 
            dedicated to promoting excellence in chemical engineering education and practice.
          </p>
          <p className="text-gray-600">
            We organize technical events, workshops, seminars, and cultural activities to enhance 
            the overall development of our members.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>Foster technical excellence in chemical engineering</li>
            <li>Provide networking opportunities with industry professionals</li>
            <li>Organize educational and cultural events</li>
            <li>Build a strong community of chemical engineers</li>
            <li>Promote innovation and research</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Committees</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-bold text-gray-900">Program Committee</h3>
              <p className="text-sm text-gray-600">Technical and academic programs</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-bold text-gray-900">Publicity Committee</h3>
              <p className="text-sm text-gray-600">Marketing and outreach</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-bold text-gray-900">Sponsorship Committee</h3>
              <p className="text-sm text-gray-600">Partnerships and funding</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-bold text-gray-900">Design Committee</h3>
              <p className="text-sm text-gray-600">Visual content creation</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-bold text-gray-900">Editorial Committee</h3>
              <p className="text-sm text-gray-600">Content and publications</p>
            </div>
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-bold text-gray-900">Web Development</h3>
              <p className="text-sm text-gray-600">Digital platforms</p>
            </div>
            <div className="border-l-4 border-pink-500 pl-4">
              <h3 className="font-bold text-gray-900">HR Committee</h3>
              <p className="text-sm text-gray-600">Team coordination</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-bold text-gray-900">Finance Committee</h3>
              <p className="text-sm text-gray-600">Financial planning</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
