'use client';

import { useState } from 'react';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';

// Component that can be made to throw an error
function ConditionalErrorComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('This is a test error to demonstrate error boundary isolation');
  }
  return (
    <div className="rounded border border-green-200 bg-green-50 p-4">
      <p className="text-sm text-green-700">✓ This section is working correctly</p>
    </div>
  );
}

export default function TestPage() {
  const [throwInSection1, setThrowInSection1] = useState(false);
  const [throwInSection2, setThrowInSection2] = useState(false);
  const [throwInSection3, setThrowInSection3] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Boundary Test Page</h1>
        <p className="text-gray-600 mb-4">
          This page demonstrates how error boundaries isolate failures. Click the buttons below to trigger
          errors in specific sections. Notice how other sections continue to work normally.
        </p>
        <div className="rounded bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <strong>💡 Key Feature:</strong> When a section fails, only that section shows an error. The rest of the
          page continues to function, and you can use the "Try Again" button to retry the failed section.
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Section 1 */}
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Section 1</h2>
            <SectionErrorBoundary section="Section 1">
              <ConditionalErrorComponent shouldThrow={throwInSection1} />
            </SectionErrorBoundary>
            <button
              onClick={() => setThrowInSection1(!throwInSection1)}
              className="mt-3 w-full rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {throwInSection1 ? 'Fix Section 1' : 'Break Section 1'}
            </button>
          </div>
        </div>

        {/* Section 2 */}
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Section 2</h2>
            <SectionErrorBoundary section="Section 2">
              <ConditionalErrorComponent shouldThrow={throwInSection2} />
            </SectionErrorBoundary>
            <button
              onClick={() => setThrowInSection2(!throwInSection2)}
              className="mt-3 w-full rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {throwInSection2 ? 'Fix Section 2' : 'Break Section 2'}
            </button>
          </div>
        </div>

        {/* Section 3 */}
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Section 3</h2>
            <SectionErrorBoundary section="Section 3">
              <ConditionalErrorComponent shouldThrow={throwInSection3} />
            </SectionErrorBoundary>
            <button
              onClick={() => setThrowInSection3(!throwInSection3)}
              className="mt-3 w-full rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {throwInSection3 ? 'Fix Section 3' : 'Break Section 3'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Click "Break Section 1" to simulate an error in the first section</li>
          <li>Notice that Section 1 shows an error, but Sections 2 and 3 continue working</li>
          <li>Click "Try Again" in the error UI to reset Section 1</li>
          <li>Click "Fix Section 1" to actually fix the error, then "Try Again"</li>
          <li>Try breaking multiple sections at once to see how they're independently isolated</li>
        </ol>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Implementation Details</h2>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">How It Works</h3>
            <p>Each section is wrapped in a <code className="bg-gray-100 px-1 py-0.5 rounded">SectionErrorBoundary</code> component.
            When an error is thrown inside a boundary, it catches the error and displays a fallback UI instead of crashing the entire page.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Benefits</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Improved user experience - partial failures don't break entire app</li>
              <li>Better resilience - one component's bug doesn't affect others</li>
              <li>Graceful degradation - users can still access working features</li>
              <li>Debugging aid - errors are isolated to specific sections</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Real-World Usage</h3>
            <p>In this application, error boundaries are used throughout the codebase to protect:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Navigation sidebar</li>
              <li>Data tables and lists</li>
              <li>Form sections</li>
              <li>Dashboard cards</li>
              <li>Configuration panels</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}